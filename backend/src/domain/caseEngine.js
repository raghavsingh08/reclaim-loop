import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { assertValidTransition } from '../modules/cases/caseStateMachine.js';
import { EventPublisher } from './eventPublisher.js';

const pendingPublications = new WeakMap();

const runInTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // withTransaction may retry the callback. Reset publications for each attempt.
      pendingPublications.set(session, []);
      result = await work(session);
    });

    for (const payload of pendingPublications.get(session) || []) {
      EventPublisher.publishCaseUpdated({
        ...payload,
        timestamp: new Date().toISOString(),
      });
    }
    return result;
  } finally {
    pendingPublications.delete(session);
    await session.endSession();
  }
};

const transition = async ({
  session,
  recoveryCase,
  toStatus,
  actorId,
  actorRole,
  metadata = {},
}) => {
  const publications = pendingPublications.get(session);
  if (!publications) {
    throw new Error('CaseEngine.transition must run inside CaseEngine.runInTransaction');
  }

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

  publications.push({
    caseId: recoveryCase._id.toString(),
    status: toStatus,
    actorId: actorId.toString(),
    actorRole,
    metadata,
  });

  return recoveryCase;
};

export const CaseEngine = Object.freeze({ runInTransaction, transition });
