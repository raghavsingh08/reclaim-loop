import mongoose from 'mongoose';
import { logger as rootLogger } from '../config/logger.js';
import { Event } from '../models/Event.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { assertValidTransition } from '../modules/cases/caseStateMachine.js';
import { ApiError } from '../utils/ApiError.js';
import { Outbox } from './outbox.js';
import { OWNER_TYPES } from '../constants/ownerTypes.js';

const postCommitActions = new WeakMap();
const PROTECTED_CASE_PATCH_FIELDS = new Set([
  '_id',
  'id',
  'status',
  'version',
  '__v',
  'createdAt',
  'updatedAt',
]);

const caseModifiedError = () => new ApiError(
  409,
  'The case was modified by another request. Refresh and try again.',
  [],
  'CASE_MODIFIED',
);

const isWriteConflict = (error) =>
  error?.code === 112 || error?.codeName === 'WriteConflict';

const registerAfterCommit = (session, action) => {
  const actions = postCommitActions.get(session);
  if (!actions) {
    throw new Error('Post-commit actions require an active CaseTransitionEngine execution');
  }
  actions.push(action);
};

const assertActiveExecution = (session) => {
  if (!postCommitActions.has(session)) {
    throw new Error('Lifecycle transitions require an active CaseTransitionEngine execution');
  }
};

const runPostCommitActions = async (session) => {
  for (const action of postCommitActions.get(session) || []) {
    try {
      await action();
    } catch (error) {
      // The database is already committed. Real-time delivery failure must not fail the command.
      console.error('Post-commit action failed:', error);
    }
  }
};

const execute = async ({ work }) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // MongoDB may retry this callback, so discard actions from failed attempts.
      postCommitActions.set(session, []);
      result = await work({
        session,
        afterCommit: (action) => registerAfterCommit(session, action),
      });
    });
    await runPostCommitActions(session);
    return result;
  } finally {
    postCommitActions.delete(session);
    await session.endSession();
  }
};

const executeOptimistic = async ({ work, session: providedSession, afterCommit }) => {
  if (providedSession) {
    if (!providedSession.inTransaction()) {
      throw new Error('The provided session must have an active transaction');
    }
    if (typeof afterCommit !== 'function') {
      throw new TypeError('afterCommit is required when using a provided session');
    }

    // The caller owns the transaction. The engine only contributes lifecycle work
    // and forwards its post-commit actions to the transaction coordinator.
    postCommitActions.set(providedSession, []);
    try {
      const result = await work({
        session: providedSession,
        afterCommit: (action) => registerAfterCommit(providedSession, action),
      });
      for (const action of postCommitActions.get(providedSession) || []) {
        afterCommit(action);
      }
      return result;
    } catch (error) {
      if (isWriteConflict(error)) throw caseModifiedError();
      throw error;
    } finally {
      postCommitActions.delete(providedSession);
    }
  }

  const session = await mongoose.startSession();
  try {
    postCommitActions.set(session, []);
    session.startTransaction();
    try {
      const result = await work({
        session,
        afterCommit: (action) => registerAfterCommit(session, action),
      });
      await session.commitTransaction();
      await runPostCommitActions(session);
      return result;
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      if (isWriteConflict(error)) throw caseModifiedError();
      throw error;
    }
  } finally {
    postCommitActions.delete(session);
    await session.endSession();
  }
};

const validateCasePatch = (casePatch) => {
  if (!casePatch || typeof casePatch !== 'object' || Array.isArray(casePatch)) {
    throw new TypeError('casePatch must be a plain object');
  }

  const protectedFields = Object.keys(casePatch)
    .filter((field) => PROTECTED_CASE_PATCH_FIELDS.has(field));
  if (protectedFields.length > 0) {
    throw new Error(
      `casePatch contains protected RecoveryCase fields: ${protectedFields.join(', ')}`,
    );
  }
};

/**
 * LEGACY: temporary compatibility for workflows not yet migrated.
 * Do not use this method for new workflow migrations.
 * Remove it after every lifecycle workflow uses transitionOptimistic().
 */
const transition = async ({
  session,
  recoveryCase,
  toStatus,
  actorId,
  actorRole,
  metadata = {},
  commandId,
  commandSequence = 1,
}) => {
  assertActiveExecution(session);
  assertValidTransition(recoveryCase.status, toStatus);

  const occurredAt = new Date();
  const previousStatus = recoveryCase.status;
  const previousVersion = Number.isInteger(recoveryCase.version)
    ? recoveryCase.version
    : undefined;
  recoveryCase.status = toStatus;
  recoveryCase.version += 1;
  await recoveryCase.save({ session });

  const nextVersion = Number.isInteger(recoveryCase.version)
    ? recoveryCase.version
    : undefined;

  const [event] = await Event.create(
    [{
      caseId: recoveryCase._id,
      type: toStatus,
      actorId,
      actorRole,
      schemaVersion: 1,
      ...(commandId && { commandId }),
      commandSequence,
      previousStatus,
      nextStatus: toStatus,
      ...(previousVersion !== undefined && { previousVersion }),
      ...(nextVersion !== undefined && { nextVersion }),
      occurredAt,
      recordedAt: new Date(),
      metadata,
    }],
    { session },
  );

  await Outbox.enqueue({
    session,
    type: 'CASE_UPDATED',
    aggregateType: 'RecoveryCase',
    aggregateId: recoveryCase._id,
    commandId,
    deduplicationKey: `${event._id}:CASE_UPDATED`,
    payload: {
      caseId: recoveryCase._id.toString(),
      customerId: recoveryCase.customerId?.toString(),
      ...(recoveryCase.currentOwnerType === OWNER_TYPES.COURIER &&
        recoveryCase.currentOwnerId && {
          courierId: recoveryCase.currentOwnerId.toString(),
        }),
      status: toStatus,
      version: recoveryCase.version,
      actorId: actorId.toString(),
      actorRole,
      timestamp: occurredAt.toISOString(),
      metadata,
    },
  });
  return recoveryCase;
};

const transitionOptimistic = async ({
  caseId,
  expectedStatus,
  expectedVersion,
  nextStatus,
  actor,
  casePatch = {},
  metadata = {},
  commandId,
  commandSequence = 1,
  logger,
  session,
}) => {
  assertActiveExecution(session);
  if (!caseId) throw new TypeError('caseId is required');
  const transitionLogger = (
    typeof logger?.child === 'function' ? logger : rootLogger
  ).child({
    component: 'case-transition-engine',
    recoveryCaseId: caseId.toString(),
  });
  if (!actor?.id || !actor?.role) {
    throw new TypeError('actor must contain id and role');
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new TypeError('expectedVersion must be a non-negative integer');
  }
  validateCasePatch(casePatch);
  const expectedTransitionFields = {
    expectedStatus,
    nextStatus,
    expectedVersion,
    nextVersion: expectedVersion + 1,
    actorRole: actor.role,
    transactionState: 'active',
  };
  transitionLogger.debug(
    { ...expectedTransitionFields, outcome: 'attempt' },
    'RecoveryCase transition attempted',
  );
  try {
    assertValidTransition(expectedStatus, nextStatus);
  } catch (error) {
    transitionLogger.warn(
      {
        outcome: 'invalid_transition',
        expectedStatus,
        nextStatus,
        expectedVersion,
        nextVersion: expectedVersion + 1,
        actorRole: actor.role,
        transactionState: 'active',
      },
      'RecoveryCase transition rejected by state machine',
    );
    throw error;
  }
  const occurredAt = new Date();

  const updatedCase = await RecoveryCase.findOneAndUpdate(
    {
      _id: caseId,
      status: expectedStatus,
      version: expectedVersion,
    },
    {
      $set: { ...casePatch, status: nextStatus },
      $inc: { version: 1 },
    },
    { new: true, runValidators: true, session },
  );

  if (!updatedCase) {
    transitionLogger.warn(
      {
        outcome: 'optimistic_conflict',
        expectedStatus,
        expectedVersion,
        nextStatus,
        nextVersion: expectedVersion + 1,
        actorRole: actor.role,
        transactionState: 'active',
      },
      'RecoveryCase optimistic transition conflict',
    );
    throw caseModifiedError();
  }

  const stagedTransitionFields = {
    previousStatus: expectedStatus,
    nextStatus,
    previousVersion: expectedVersion,
    nextVersion: expectedVersion + 1,
    actorRole: actor.role,
    transactionState: 'active',
  };
  transitionLogger.debug(
    { ...stagedTransitionFields, outcome: 'case_write_staged' },
    'RecoveryCase transition write staged',
  );

  await Event.create(
    [{
      caseId: updatedCase._id,
      type: nextStatus,
      actorId: actor.id,
      actorRole: actor.role,
      schemaVersion: 1,
      ...(commandId && { commandId }),
      commandSequence,
      previousStatus: expectedStatus,
      nextStatus,
      previousVersion: expectedVersion,
      nextVersion: expectedVersion + 1,
      occurredAt,
      recordedAt: new Date(),
      metadata,
    }],
    { session },
  );

  transitionLogger.debug(
    {
      outcome: 'event_write_staged',
      eventType: nextStatus,
      commandSequence,
      transactionState: 'active',
    },
    'Lifecycle Event write staged',
  );

  return updatedCase;
};

export const CaseTransitionEngine = Object.freeze({
  execute,
  executeOptimistic,
  transition,
  transitionOptimistic,
});
