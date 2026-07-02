import { Event } from '../models/Event.js';
import { assertValidTransition } from '../modules/cases/caseStateMachine.js';
import { EventPublisher } from './eventPublisher.js';

const transition = async ({
  session,
  recoveryCase,
  toStatus,
  actorId,
  actorRole,
  metadata = {},
}) => {
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

  EventPublisher.publishCaseUpdated({
    caseId: recoveryCase._id.toString(),
    status: toStatus,
    actorId: actorId.toString(),
    actorRole,
    timestamp: new Date().toISOString(),
    metadata,
  });

  return recoveryCase;
};

export const CaseEngine = Object.freeze({ transition });
