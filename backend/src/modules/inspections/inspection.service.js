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
import { EventPublisher } from '../../domain/eventPublisher.js';
import { Inspection } from '../../models/Inspection.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  createAdminNotifications,
  createNotification,
} from '../notifications/notification.service.js';

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

export const assignInspection = async (caseId, { inspectorId }, actor) => {
  requireObjectId(caseId, 'case ID');
  requireObjectId(inspectorId, 'inspector ID');

  let inspection;
  await CaseEngine.runInTransaction(async (session) => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      const inspector = await User.findOne({
        _id: inspectorId,
        role: USER_ROLES.INSPECTOR,
        isActive: true,
      }).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');
      if (!inspector) throw new ApiError(400, 'Inspector must be an active INSPECTOR user');
      if (
        ![
          CASE_STATUSES.FACILITY_RECEIVED,
          CASE_STATUSES.REINSPECTION_REQUESTED,
        ].includes(recoveryCase.status)
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

      const previousStatus = recoveryCase.status;
      const latestInspection = await Inspection.findOne({ caseId: recoveryCase._id })
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

      recoveryCase.inspectionId = inspection._id;
      await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.INSPECTION_ASSIGNED,
        actorId: actor._id,
        actorRole: actor.role,
        metadata: {
          inspectionId: inspection._id,
          inspectorId: inspector._id,
          facilityId: inspection.facilityId,
          previousStatus,
        },
      });
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
  });

  EventPublisher.publishInspectionStarted({
      caseId: inspection.caseId.toString(),
      inspectionId: inspection._id.toString(),
      inspectorId: inspection.inspectorId.toString(),
      facilityId: inspection.facilityId.toString(),
      timestamp: new Date().toISOString(),
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
  });

  await Promise.all([
      createNotification({
        userId: customerId,
        caseId: inspection.caseId,
        type: CASE_STATUSES.INSPECTION_COMPLETED,
        title: 'Inspection completed',
        message: 'Inspection of your recovered item was completed.',
        metadata: { inspectionId: inspection._id, recommendedOutcome },
      }),
      createAdminNotifications({
        caseId: inspection.caseId,
        type: CASE_STATUSES.INSPECTION_COMPLETED,
        title: 'Decision needed',
        message: 'A completed inspection is ready for an administrative decision.',
        metadata: { inspectionId: inspection._id, recommendedOutcome },
      }),
  ]);
  EventPublisher.publishInspectionCompleted({
      caseId: inspection.caseId.toString(),
      inspectionId: inspection._id.toString(),
      inspectorId: inspection.inspectorId.toString(),
      facilityId: inspection.facilityId.toString(),
      condition: inspection.condition,
      recommendedOutcome: inspection.recommendedOutcome,
      timestamp: new Date().toISOString(),
  });
  return inspection;
};

export const getInspectionByCase = async (caseId, actor) => {
  requireObjectId(caseId, 'case ID');
  const inspection = await Inspection.findOne({ caseId })
    .sort({ createdAt: -1 })
    .populate('caseId')
    .populate('facilityId', 'name type location');
  if (!inspection) throw new ApiError(404, 'Inspection not found');
  if (
    actor.role === USER_ROLES.INSPECTOR &&
    !inspection.inspectorId.equals(actor._id)
  ) {
    throw new ApiError(404, 'Inspection not found');
  }

  const history = await Inspection.find({ caseId })
    .sort({ createdAt: -1 })
    .populate('facilityId', 'name type location');

  return { inspection, history };
};

export const getMyInspections = async (inspector) => {
  const inspections = await Inspection.find({ inspectorId: inspector._id })
    .populate(
      'caseId',
      'caseCode status requestType product.name product.category product.serialNumber pickupAddress assignedFacilityId',
    )
    .populate(
      'facilityId',
      'name type location.city location.state location.pincode',
    )
    .sort({ createdAt: -1 })
    .lean();

  return inspections.map((inspection) => ({
    ...inspection,
    recoveryCase: inspection.caseId,
  }));
};
