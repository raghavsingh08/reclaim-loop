import mongoose from 'mongoose';
import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { DECISION_TYPES, DECISION_TYPE_VALUES } from '../../constants/decisionTypes.js';
import { CaseEngine } from '../../domain/caseEngine.js';
import { Decision } from '../../models/Decision.js';
import { Inspection } from '../../models/Inspection.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  createAdminNotifications,
  createNotification,
} from '../notifications/notification.service.js';

const decisionStatusMap = Object.freeze({
  [DECISION_TYPES.APPROVE_REFUND]: CASE_STATUSES.REFUND_PENDING,
  [DECISION_TYPES.APPROVE_REPAIR]: CASE_STATUSES.REPAIR_PENDING,
  [DECISION_TYPES.APPROVE_EXCHANGE]: CASE_STATUSES.EXCHANGE_PENDING,
  [DECISION_TYPES.APPROVE_RECYCLE]: CASE_STATUSES.RECYCLE_PENDING,
  [DECISION_TYPES.REJECT_REQUEST]: CASE_STATUSES.REQUEST_REJECTED,
  [DECISION_TYPES.REQUEST_REINSPECTION]: CASE_STATUSES.REINSPECTION_REQUESTED,
});

const requireCaseId = (caseId) => {
  if (!mongoose.isValidObjectId(caseId)) throw new ApiError(400, 'Invalid case ID');
};

const getCompletedInspection = async (caseId, session) => {
  const inspection = await Inspection.findOne({
    caseId,
    completedAt: { $ne: null },
  }).session(session);
  if (!inspection) throw new ApiError(409, 'A completed inspection is required');
  return inspection;
};

export const startDecisionReview = async (caseId, actor) => {
  requireCaseId(caseId);
  let updatedCase;
  await CaseEngine.runInTransaction(async (session) => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');
      const inspection = await getCompletedInspection(recoveryCase._id, session);

      updatedCase = await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.DECISION_PENDING,
        actorId: actor._id,
        actorRole: actor.role,
        metadata: {
          recommendation: inspection.recommendedOutcome,
          inspectionId: inspection._id,
        },
      });

      await createAdminNotifications(
        {
          caseId: updatedCase._id,
          type: CASE_STATUSES.DECISION_PENDING,
          title: 'Case pending decision',
          message: 'A recovery case is awaiting an administrative decision.',
          metadata: { recommendation: updatedCase.outcome },
        },
        { session },
      );
  });
  return updatedCase;
};

export const makeDecision = async (
  caseId,
  { decision, reason, comments },
  actor,
) => {
  requireCaseId(caseId);
  if (!DECISION_TYPE_VALUES.includes(decision)) {
    throw new ApiError(400, `Decision must be one of: ${DECISION_TYPE_VALUES.join(', ')}`);
  }

  let decisionRecord;
  let updatedCase;
  await CaseEngine.runInTransaction(async (session) => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');
      const inspection = await getCompletedInspection(recoveryCase._id, session);

      [decisionRecord] = await Decision.create(
        [{
          caseId: recoveryCase._id,
          recommendation: inspection.recommendedOutcome,
          decision,
          decidedBy: actor._id,
          reason: reason?.trim() || null,
          comments: comments?.trim() || null,
        }],
        { session },
      );

      updatedCase = await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: decisionStatusMap[decision],
        actorId: actor._id,
        actorRole: actor.role,
        metadata: {
          decision,
          reason: reason?.trim() || null,
          comments: comments?.trim() || null,
        },
      });

      await createNotification({
        userId: updatedCase.customerId,
        caseId: updatedCase._id,
        type: updatedCase.status,
        title: 'Decision recorded',
        message: 'A decision was recorded for your recovery case.',
        metadata: {
          decisionId: decisionRecord._id,
          decision: decisionRecord.decision,
        },
        session,
      });
  });
  return { case: updatedCase, decision: decisionRecord };
};

export const getCaseDecisions = async (caseId) => {
  requireCaseId(caseId);
  if (!(await RecoveryCase.exists({ _id: caseId }))) {
    throw new ApiError(404, 'Recovery case not found');
  }
  return Decision.find({ caseId }).sort({ createdAt: -1 });
};
