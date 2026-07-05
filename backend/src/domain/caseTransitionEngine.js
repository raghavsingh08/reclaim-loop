import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { assertValidTransition } from '../modules/cases/caseStateMachine.js';
import { ApiError } from '../utils/ApiError.js';
import { EventPublisher } from './eventPublisher.js';

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

const registerCaseSocketEvent = ({
  session,
  recoveryCase,
  status,
  actor,
  metadata,
}) => {
  registerAfterCommit(session, () => EventPublisher.publishCaseUpdated({
    caseId: recoveryCase._id.toString(),
    status,
    actorId: actor.id.toString(),
    actorRole: actor.role,
    timestamp: new Date().toISOString(),
    metadata,
  }));
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

const executeOptimistic = async ({ work }) => {
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
}) => {
  assertActiveExecution(session);
  assertValidTransition(recoveryCase.status, toStatus);

  recoveryCase.status = toStatus;
  recoveryCase.version += 1;
  await recoveryCase.save({ session });

  await Event.create(
    [{
      caseId: recoveryCase._id,
      type: toStatus,
      actorId,
      actorRole,
      metadata,
    }],
    { session },
  );

  registerCaseSocketEvent({
    session,
    recoveryCase,
    status: toStatus,
    actor: { id: actorId, role: actorRole },
    metadata,
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
  session,
}) => {
  assertActiveExecution(session);
  if (!caseId) throw new TypeError('caseId is required');
  if (!actor?.id || !actor?.role) {
    throw new TypeError('actor must contain id and role');
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new TypeError('expectedVersion must be a non-negative integer');
  }
  validateCasePatch(casePatch);
  assertValidTransition(expectedStatus, nextStatus);

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

  if (!updatedCase) throw caseModifiedError();

  await Event.create(
    [{
      caseId: updatedCase._id,
      type: nextStatus,
      actorId: actor.id,
      actorRole: actor.role,
      metadata,
    }],
    { session },
  );

  registerCaseSocketEvent({
    session,
    recoveryCase: updatedCase,
    status: nextStatus,
    actor,
    metadata,
  });
  return updatedCase;
};

export const CaseTransitionEngine = Object.freeze({
  execute,
  executeOptimistic,
  transition,
  transitionOptimistic,
});
