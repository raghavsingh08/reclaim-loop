import mongoose from 'mongoose';
import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { INSPECTION_STATUSES } from '../../constants/inspectionStatus.js';
import {
  INSPECTION_CONDITION_VALUES,
  RECOMMENDED_OUTCOME_VALUES,
} from '../../constants/inspectionValues.js';
import { OWNER_TYPES } from '../../constants/ownerTypes.js';
import { USER_ROLES } from '../../constants/roles.js';
import { CaseEngine } from '../../domain/caseEngine.js';
import { CaseTransitionEngine } from '../../domain/caseTransitionEngine.js';
import { Outbox } from '../../domain/outbox.js';
import { Inspection } from '../../models/Inspection.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  createAdminNotifications,
  createNotification,
} from '../notifications/notification.service.js';

const DEFAULT_INSPECTION_LIMIT = 25;
const MAX_INSPECTION_LIMIT = 100;
const INSPECTION_CURSOR_VERSION = 1;

const parseInspectionLimit = (value) => {
  if (value === undefined) return DEFAULT_INSPECTION_LIMIT;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ApiError(400, 'Inspection limit must be an integer between 1 and 100');
  }

  const limit = Number(value);
  if (limit < 1 || limit > MAX_INSPECTION_LIMIT) {
    throw new ApiError(400, 'Inspection limit must be an integer between 1 and 100');
  }
  return limit;
};

const encodeInspectionCursor = ({ createdAt, _id }) => Buffer.from(JSON.stringify({
  v: INSPECTION_CURSOR_VERSION,
  createdAt: createdAt.toISOString(),
  id: _id.toString(),
})).toString('base64url');

const decodeInspectionCursor = (value) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new ApiError(400, 'Invalid inspection cursor');
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const createdAt = new Date(decoded.createdAt);
    if (
      decoded.v !== INSPECTION_CURSOR_VERSION ||
      typeof decoded.createdAt !== 'string' ||
      Number.isNaN(createdAt.getTime()) ||
      typeof decoded.id !== 'string' ||
      !mongoose.isValidObjectId(decoded.id)
    ) {
      throw new Error('Invalid cursor payload');
    }
    return { createdAt, id: new mongoose.Types.ObjectId(decoded.id) };
  } catch {
    throw new ApiError(400, 'Invalid inspection cursor');
  }
};

const requireObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(400, `Invalid ${label}`);
};

const assertAssignedInspector = (inspection, actor) => {
  if (
    actor.role !== USER_ROLES.ADMIN &&
    !inspection.inspectorId.equals(actor._id)
  ) {
    throw new ApiError(403, 'Inspection is assigned to another inspector');
  }
};

export const assignInspection = async (
  caseId,
  { inspectorId },
  actor,
  { session, commandId, afterCommit, logger } = {},
) => {
  requireObjectId(caseId, 'case ID');
  requireObjectId(inspectorId, 'inspector ID');
  if (!session || typeof afterCommit !== 'function') {
    throw new TypeError('Inspection assignment requires a coordinated transaction context');
  }

  let inspection;
  await CaseTransitionEngine.executeOptimistic({
    session,
    afterCommit,
    work: async ({ session }) => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');

      // Capture the state token that this admin assignment was based on.
      const expectedStatus = recoveryCase.status;
      const expectedVersion = recoveryCase.version;

      const inspector = await User.findOne({
        _id: inspectorId,
        role: USER_ROLES.INSPECTOR,
        isActive: true,
      }).select('_id role isActive').session(session);
      if (!inspector) throw new ApiError(400, 'Inspector must be an active INSPECTOR user');
      if (
        ![
          CASE_STATUSES.FACILITY_RECEIVED,
          CASE_STATUSES.REINSPECTION_REQUESTED,
        ].includes(expectedStatus)
      ) {
        throw new ApiError(409, 'Case must be facility-received or approved for reinspection');
      }
      if (!recoveryCase.assignedFacilityId) {
        throw new ApiError(409, 'Case does not have an assigned facility');
      }
      if (
        recoveryCase.currentOwnerType !== OWNER_TYPES.FACILITY ||
        !recoveryCase.currentOwnerId?.equals(recoveryCase.assignedFacilityId)
      ) {
        throw new ApiError(409, 'Case is not in the custody of its assigned facility');
      }

      const previousStatus = expectedStatus;
      const latestInspection = await Inspection.findOne({ caseId: recoveryCase._id })
        .select('_id status completedAt')
        .sort({ createdAt: -1 })
        .session(session);

      if (previousStatus === CASE_STATUSES.FACILITY_RECEIVED && latestInspection) {
        if (latestInspection.status === INSPECTION_STATUSES.COMPLETED || latestInspection.completedAt) {
          throw new ApiError(409, 'Completed inspection requires an approved reinspection decision');
        }
        throw new ApiError(409, 'Case already has an active inspection assignment');
      }
      if (
        previousStatus === CASE_STATUSES.REINSPECTION_REQUESTED &&
        (!latestInspection ||
          (latestInspection.status !== INSPECTION_STATUSES.COMPLETED &&
            !latestInspection.completedAt))
      ) {
        throw new ApiError(409, 'Reinspection requires a previously completed inspection');
      }

      [inspection] = await Inspection.create(
        [{
          caseId: recoveryCase._id,
          inspectorId: inspector._id,
          facilityId: recoveryCase.assignedFacilityId,
          status: INSPECTION_STATUSES.ASSIGNED,
          assignedAt: new Date(),
        }],
        { session },
      );

      const updatedCase = await CaseTransitionEngine.transitionOptimistic({
        caseId: recoveryCase._id,
        expectedStatus,
        expectedVersion,
        nextStatus: CASE_STATUSES.INSPECTION_ASSIGNED,
        actor: {
          id: actor._id,
          role: actor.role,
        },
        casePatch: { inspectionId: inspection._id },
        metadata: {
          inspectionId: inspection._id,
          inspectorId: inspector._id,
          facilityId: inspection.facilityId,
          previousStatus,
        },
        commandId,
        logger,
        session,
      });

      await Outbox.enqueue({
        session,
        type: 'CASE_UPDATED',
        aggregateType: 'RecoveryCase',
        aggregateId: updatedCase._id,
        commandId,
        deduplicationKey: `${commandId}:CASE_UPDATED`,
        payload: {
          caseId: updatedCase._id.toString(),
          customerId: updatedCase.customerId.toString(),
          version: updatedCase.version,
          status: updatedCase.status,
        },
        logger,
      });

      await Outbox.enqueue({
        session,
        type: 'INSPECTION_ASSIGNED',
        aggregateType: 'Inspection',
        aggregateId: inspection._id,
        commandId,
        deduplicationKey: `${commandId}:INSPECTION_ASSIGNED:${inspection._id}`,
        payload: {
          caseId: inspection.caseId.toString(),
          inspectionId: inspection._id.toString(),
          inspectorId: inspection.inspectorId.toString(),
          facilityId: inspection.facilityId.toString(),
          status: inspection.status,
          timestamp: inspection.assignedAt.toISOString(),
        },
        logger,
      });

      await createNotification({
        userId: inspection.inspectorId,
        caseId: inspection.caseId,
        type: CASE_STATUSES.INSPECTION_ASSIGNED,
        title: 'Inspection assigned',
        message: 'A recovery case inspection has been assigned to you.',
        metadata: {
          inspectionId: inspection._id,
          facilityId: inspection.facilityId,
        },
        session,
        commandId,
        logger,
      });
    },
  });
  return inspection;
};

export const startInspection = async (caseId, actor) => {
  requireObjectId(caseId, 'case ID');
  let inspection;
  await CaseEngine.runInTransaction(async (session) => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');
      if (recoveryCase.status !== CASE_STATUSES.INSPECTION_ASSIGNED) {
        throw new ApiError(409, 'Case must be assigned for inspection before it can start');
      }

      inspection = await Inspection.findOne({
        _id: recoveryCase.inspectionId,
        caseId: recoveryCase._id,
      }).session(session);
      if (!inspection) throw new ApiError(404, 'Assigned inspection not found');
      assertAssignedInspector(inspection, actor);
      if (inspection.status !== INSPECTION_STATUSES.ASSIGNED) {
        throw new ApiError(409, 'Inspection is not in ASSIGNED status');
      }

      inspection.status = INSPECTION_STATUSES.IN_PROGRESS;
      inspection.startedAt = new Date();
      await inspection.save({ session });

      await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.INSPECTION_PENDING,
        actorId: actor._id,
        actorRole: actor.role,
        metadata: {
          inspectionId: inspection._id,
          inspectorId: inspection.inspectorId,
          facilityId: inspection.facilityId,
          previousStatus: CASE_STATUSES.INSPECTION_ASSIGNED,
        },
      });

      await Outbox.enqueue({
        session,
        type: 'INSPECTION_STARTED',
        aggregateType: 'Inspection',
        aggregateId: inspection._id,
        commandId: undefined,
        deduplicationKey: `${inspection._id}:INSPECTION_STARTED`,
        payload: {
          caseId: inspection.caseId.toString(),
          inspectionId: inspection._id.toString(),
          inspectorId: inspection.inspectorId.toString(),
          facilityId: inspection.facilityId.toString(),
          timestamp: inspection.startedAt.toISOString(),
        },
      });
  });
  return inspection;
};

export const completeInspection = async (
  caseId,
  { condition, notes, images, recommendedOutcome },
  actor,
) => {
  requireObjectId(caseId, 'case ID');
  if (!INSPECTION_CONDITION_VALUES.includes(condition)) {
    throw new ApiError(400, `Condition must be one of: ${INSPECTION_CONDITION_VALUES.join(', ')}`);
  }
  if (!RECOMMENDED_OUTCOME_VALUES.includes(recommendedOutcome)) {
    throw new ApiError(400, `Recommended outcome must be one of: ${RECOMMENDED_OUTCOME_VALUES.join(', ')}`);
  }
  if (
    images !== undefined &&
    (!Array.isArray(images) || images.some((image) => !image?.url?.trim()))
  ) {
    throw new ApiError(400, 'Images must be an array of objects containing a URL');
  }

  let inspection;
  let customerId;
  await CaseEngine.runInTransaction(async (session) => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');
      if (recoveryCase.status !== CASE_STATUSES.INSPECTION_PENDING) {
        throw new ApiError(409, 'Case must have an inspection in progress');
      }
      customerId = recoveryCase.customerId;

      inspection = await Inspection.findOne({
        _id: recoveryCase.inspectionId,
        caseId: recoveryCase._id,
      }).session(session);
      if (!inspection) throw new ApiError(404, 'Inspection has not been assigned');
      assertAssignedInspector(inspection, actor);
      if (inspection.status !== INSPECTION_STATUSES.IN_PROGRESS) {
        throw new ApiError(409, 'Inspection is not in progress');
      }

      inspection.status = INSPECTION_STATUSES.COMPLETED;
      inspection.condition = condition;
      inspection.notes = notes?.trim() || null;
      if (images !== undefined) inspection.images = images;
      inspection.recommendedOutcome = recommendedOutcome;
      inspection.completedAt = new Date();
      await inspection.save({ session });

      recoveryCase.outcome = recommendedOutcome;
      await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.INSPECTION_COMPLETED,
        actorId: actor._id,
        actorRole: actor.role,
        metadata: { condition, recommendedOutcome },
      });

      await Outbox.enqueue({
        session,
        type: 'INSPECTION_COMPLETED',
        aggregateType: 'Inspection',
        aggregateId: inspection._id,
        commandId: undefined,
        deduplicationKey: `${inspection._id}:INSPECTION_COMPLETED`,
        payload: {
          caseId: inspection.caseId.toString(),
          inspectionId: inspection._id.toString(),
          inspectorId: inspection.inspectorId.toString(),
          facilityId: inspection.facilityId.toString(),
          condition: inspection.condition,
          recommendedOutcome: inspection.recommendedOutcome,
          timestamp: inspection.completedAt.toISOString(),
        },
      });

      await createAdminNotifications(
        {
          caseId: inspection.caseId,
          type: CASE_STATUSES.INSPECTION_COMPLETED,
          title: 'Decision needed',
          message: 'A completed inspection is ready for an administrative decision.',
          metadata: { inspectionId: inspection._id, recommendedOutcome },
        },
        { session },
      );

      await createNotification({
        userId: customerId,
        caseId: inspection.caseId,
        type: CASE_STATUSES.INSPECTION_COMPLETED,
        title: 'Inspection completed',
        message: 'Inspection of your recovered item was completed.',
        metadata: { inspectionId: inspection._id, recommendedOutcome },
        session,
      });
  });
  return inspection;
};

export const getInspectionByCase = async (caseId, actor) => {
  requireObjectId(caseId, 'case ID');
  const inspection = await Inspection.findOne({ caseId })
    .sort({ createdAt: -1 })
    .populate('caseId')
    .populate('facilityId', 'name type location')
    .lean();
  if (!inspection) throw new ApiError(404, 'Inspection not found');
  if (
    actor.role === USER_ROLES.INSPECTOR &&
    String(inspection.inspectorId) !== String(actor._id)
  ) {
    throw new ApiError(404, 'Inspection not found');
  }

  const history = await Inspection.find({ caseId })
    .sort({ createdAt: -1 })
    .populate('facilityId', 'name type location')
    .lean();

  return { inspection, history };
};

export const getMyInspections = async (inspector, { limit: rawLimit, cursor: rawCursor } = {}) => {
  const limit = parseInspectionLimit(rawLimit);
  const filter = { inspectorId: inspector._id };

  if (rawCursor !== undefined) {
    const cursor = decodeInspectionCursor(rawCursor);
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ];
  }

  const results = await Inspection.find(filter)
    .populate(
      'caseId',
      'caseCode status requestType product.name product.category product.serialNumber pickupAddress assignedFacilityId',
    )
    .populate(
      'facilityId',
      'name type location.city location.state location.pincode',
    )
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasNextPage = results.length > limit;
  const inspections = hasNextPage ? results.slice(0, limit) : results;
  const lastInspection = inspections.at(-1);

  return {
    inspections: inspections.map((inspection) => ({
      ...inspection,
      recoveryCase: inspection.caseId,
    })),
    pageInfo: {
      nextCursor: hasNextPage && lastInspection ? encodeInspectionCursor(lastInspection) : null,
      hasNextPage,
    },
  };
};
