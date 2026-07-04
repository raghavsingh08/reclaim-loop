import mongoose from 'mongoose';
import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { FACILITY_TYPE_VALUES } from '../../constants/facilityTypes.js';
import { OWNER_TYPES } from '../../constants/ownerTypes.js';
import { TRANSFER_TYPES } from '../../constants/transferTypes.js';
import { CaseEngine } from '../../domain/caseEngine.js';
import { CustodyRecord } from '../../models/CustodyRecord.js';
import { Facility } from '../../models/Facility.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { ApiError } from '../../utils/ApiError.js';
import { createNotification } from '../notifications/notification.service.js';

const requireObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(400, `Invalid ${label}`);
};

const validateCapacity = ({ total, reserved, available }) => {
  if (![total, reserved, available].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new ApiError(400, 'Capacity values must be non-negative numbers');
  }
  if (reserved + available > total) {
    throw new ApiError(400, 'Reserved plus available capacity cannot exceed total capacity');
  }
};

export const createFacility = async ({ name, type, location, supportedCategories, capacity }) => {
  if (!name?.trim() || !type || !location?.city?.trim() || !location?.state?.trim() || !location?.pincode?.trim()) {
    throw new ApiError(400, 'Name, type, and complete location are required');
  }
  if (!FACILITY_TYPE_VALUES.includes(type)) {
    throw new ApiError(400, `Facility type must be one of: ${FACILITY_TYPE_VALUES.join(', ')}`);
  }

  const total = capacity?.total ?? 0;
  const reserved = capacity?.reserved ?? 0;
  const available = capacity?.available ?? total - reserved;
  validateCapacity({ total, reserved, available });

  return Facility.create({
    name: name.trim(),
    type,
    location,
    supportedCategories: supportedCategories || [],
    capacity: { total, reserved, available },
  });
};

export const listFacilities = () => Facility.find().sort({ name: 1 });

export const getFacilityById = async (facilityId) => {
  requireObjectId(facilityId, 'facility ID');
  const facility = await Facility.findById(facilityId);
  if (!facility) throw new ApiError(404, 'Facility not found');
  return facility;
};

export const updateFacilityCapacity = async (facilityId, input) => {
  const facility = await getFacilityById(facilityId);
  const capacityInput = input.capacity || input;
  const total = capacityInput.total ?? facility.capacity.total;
  const reserved = capacityInput.reserved ?? facility.capacity.reserved;
  const available = capacityInput.available ?? total - reserved;
  validateCapacity({ total, reserved, available });

  facility.capacity = { total, reserved, available };
  return facility.save();
};

export const receiveCaseAtFacility = async (facilityId, caseId, { proof } = {}, actor) => {
  requireObjectId(facilityId, 'facility ID');
  requireObjectId(caseId, 'case ID');

  let updatedCase;
  await CaseEngine.runInTransaction(async (session) => {
      const facility = await Facility.findOne({
        _id: facilityId,
        isActive: true,
      }).session(session);
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!facility) throw new ApiError(404, 'Active facility not found');
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');
      if (![CASE_STATUSES.DELIVERED_TO_FACILITY, CASE_STATUSES.ITEM_COLLECTED].includes(recoveryCase.status)) {
        throw new ApiError(409, 'Only a delivered or collected item can be received');
      }
      if (recoveryCase.currentOwnerType !== OWNER_TYPES.COURIER || !recoveryCase.currentOwnerId) {
        throw new ApiError(409, 'Case custody is not currently held by a courier');
      }
      if (
        recoveryCase.assignedFacilityId &&
        !recoveryCase.assignedFacilityId.equals(facility._id)
      ) {
        throw new ApiError(409, 'Item cannot be received at a facility other than its assigned destination');
      }

      const previousStatus = recoveryCase.status;
      const courierId = recoveryCase.currentOwnerId;

      recoveryCase.currentOwnerType = OWNER_TYPES.FACILITY;
      recoveryCase.currentOwnerId = facility._id;
      if (!recoveryCase.assignedFacilityId) recoveryCase.assignedFacilityId = facility._id;
      updatedCase = await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.FACILITY_RECEIVED,
        actorId: actor._id,
        actorRole: actor.role,
        metadata: { facilityId: facility._id, previousStatus },
      });

      await CustodyRecord.create(
        [{
          caseId: recoveryCase._id,
          fromOwnerType: OWNER_TYPES.COURIER,
          fromOwnerId: courierId,
          toOwnerType: OWNER_TYPES.FACILITY,
          toOwnerId: facility._id,
          transferType: TRANSFER_TYPES.WAREHOUSE_HANDOFF,
          proof: proof || {},
          transferredBy: actor._id,
        }],
        { session },
      );
  });
  await createNotification({
      userId: updatedCase.customerId,
      caseId: updatedCase._id,
      type: CASE_STATUSES.FACILITY_RECEIVED,
      title: 'Item received at facility',
      message: 'Your item was received at the assigned recovery facility.',
      metadata: { facilityId },
  });
  return updatedCase;
};
