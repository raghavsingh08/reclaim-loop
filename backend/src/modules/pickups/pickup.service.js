import mongoose from 'mongoose';
import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { OWNER_TYPES } from '../../constants/ownerTypes.js';
import { PICKUP_STATUSES } from '../../constants/pickupStatus.js';
import { USER_ROLES } from '../../constants/roles.js';
import { TRANSFER_TYPES } from '../../constants/transferTypes.js';
import { CustodyRecord } from '../../models/CustodyRecord.js';
import { Event } from '../../models/Event.js';
import { Pickup } from '../../models/Pickup.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertValidTransition } from '../cases/caseStateMachine.js';

const requireObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(400, `Invalid ${label}`);
};

const createEvent = (caseId, type, actor, metadata, session) =>
  Event.create(
    [{ caseId, type, actorId: actor._id, actorRole: actor.role, metadata }],
    { session },
  );

const getCourierPickup = async (pickupId, courierId, session) => {
  requireObjectId(pickupId, 'pickup ID');
  const pickup = await Pickup.findOne({ _id: pickupId, courierId }).session(session);
  if (!pickup) throw new ApiError(404, 'Assigned pickup not found');
  return pickup;
};

const getPickupCase = async (pickup, session) => {
  const recoveryCase = await RecoveryCase.findById(pickup.caseId).session(session);
  if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');
  return recoveryCase;
};

export const assignPickup = async (input, actor) => {
  const { caseId, courierId, pickupAddress, scheduledWindow } = input;
  if (!caseId || !courierId || !pickupAddress || !scheduledWindow?.start || !scheduledWindow?.end) {
    throw new ApiError(400, 'Case ID, courier ID, pickup address, and scheduled window are required');
  }
  if (!pickupAddress.line1?.trim() || !pickupAddress.city?.trim() || !pickupAddress.state?.trim() || !pickupAddress.pincode?.trim()) {
    throw new ApiError(400, 'Address line1, city, state, and pincode are required');
  }
  requireObjectId(caseId, 'case ID');
  requireObjectId(courierId, 'courier ID');

  const windowStart = new Date(scheduledWindow.start);
  const windowEnd = new Date(scheduledWindow.end);
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime()) || windowEnd <= windowStart) {
    throw new ApiError(400, 'Scheduled window must contain valid dates with end after start');
  }

  const session = await mongoose.startSession();
  try {
    let assignedPickup;
    await session.withTransaction(async () => {
      const [recoveryCase, courier] = await Promise.all([
        RecoveryCase.findById(caseId).session(session),
        User.findOne({ _id: courierId, role: USER_ROLES.COURIER, isActive: true }).session(session),
      ]);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');
      if (!courier) throw new ApiError(400, 'Courier must be an active COURIER user');
      if (recoveryCase.pickupId) throw new ApiError(409, 'A pickup is already assigned to this case');
      assertValidTransition(recoveryCase.status, CASE_STATUSES.PICKUP_ASSIGNED);

      [assignedPickup] = await Pickup.create(
        [{
          caseId: recoveryCase._id,
          customerId: recoveryCase.customerId,
          courierId: courier._id,
          pickupAddress,
          scheduledWindow: { start: windowStart, end: windowEnd },
        }],
        { session },
      );

      recoveryCase.status = CASE_STATUSES.PICKUP_ASSIGNED;
      recoveryCase.pickupId = assignedPickup._id;
      recoveryCase.currentOwnerType = OWNER_TYPES.CUSTOMER;
      recoveryCase.currentOwnerId = recoveryCase.customerId;
      recoveryCase.version += 1;
      await recoveryCase.save({ session });

      await createEvent(
        recoveryCase._id,
        CASE_STATUSES.PICKUP_ASSIGNED,
        actor,
        { pickupId: assignedPickup._id, courierId: courier._id, previousStatus: CASE_STATUSES.CASE_CREATED },
        session,
      );
    });
    return assignedPickup;
  } finally {
    await session.endSession();
  }
};

export const acceptPickup = async (pickupId, courier) => {
  const session = await mongoose.startSession();
  try {
    let acceptedPickup;
    await session.withTransaction(async () => {
      const pickup = await getCourierPickup(pickupId, courier._id, session);
      if (pickup.status !== PICKUP_STATUSES.ASSIGNED) {
        throw new ApiError(409, 'Only an assigned pickup can be accepted');
      }
      const recoveryCase = await getPickupCase(pickup, session);
      assertValidTransition(recoveryCase.status, CASE_STATUSES.PICKUP_ACCEPTED);

      pickup.status = PICKUP_STATUSES.ACCEPTED;
      pickup.acceptedAt = new Date();
      acceptedPickup = await pickup.save({ session });
      recoveryCase.status = CASE_STATUSES.PICKUP_ACCEPTED;
      recoveryCase.version += 1;
      await recoveryCase.save({ session });
      await createEvent(recoveryCase._id, CASE_STATUSES.PICKUP_ACCEPTED, courier, {
        pickupId: pickup._id,
        previousStatus: CASE_STATUSES.PICKUP_ASSIGNED,
      }, session);
    });
    return acceptedPickup;
  } finally {
    await session.endSession();
  }
};

export const collectPickup = async (pickupId, { proof } = {}, courier) => {
  const session = await mongoose.startSession();
  try {
    let collectedPickup;
    await session.withTransaction(async () => {
      const pickup = await getCourierPickup(pickupId, courier._id, session);
      if (pickup.status !== PICKUP_STATUSES.ACCEPTED) {
        throw new ApiError(409, 'Only an accepted pickup can be collected');
      }
      const recoveryCase = await getPickupCase(pickup, session);
      assertValidTransition(recoveryCase.status, CASE_STATUSES.ITEM_COLLECTED);

      pickup.status = PICKUP_STATUSES.COLLECTED;
      pickup.collectedAt = new Date();
      collectedPickup = await pickup.save({ session });

      recoveryCase.status = CASE_STATUSES.ITEM_COLLECTED;
      recoveryCase.currentOwnerType = OWNER_TYPES.COURIER;
      recoveryCase.currentOwnerId = courier._id;
      recoveryCase.version += 1;
      await recoveryCase.save({ session });

      await CustodyRecord.create(
        [{
          caseId: recoveryCase._id,
          fromOwnerType: OWNER_TYPES.CUSTOMER,
          fromOwnerId: recoveryCase.customerId,
          toOwnerType: OWNER_TYPES.COURIER,
          toOwnerId: courier._id,
          transferType: TRANSFER_TYPES.PICKUP,
          proof: proof || {},
          transferredBy: courier._id,
        }],
        { session },
      );
      await createEvent(recoveryCase._id, CASE_STATUSES.ITEM_COLLECTED, courier, {
        pickupId: pickup._id,
        previousStatus: CASE_STATUSES.PICKUP_ACCEPTED,
      }, session);
    });
    return collectedPickup;
  } finally {
    await session.endSession();
  }
};

export const failPickup = async (pickupId, { reason } = {}, courier) => {
  const session = await mongoose.startSession();
  try {
    let failedPickup;
    await session.withTransaction(async () => {
      const pickup = await getCourierPickup(pickupId, courier._id, session);
      if (![PICKUP_STATUSES.ASSIGNED, PICKUP_STATUSES.ACCEPTED].includes(pickup.status)) {
        throw new ApiError(409, 'Only an assigned or accepted pickup can be failed');
      }
      const recoveryCase = await getPickupCase(pickup, session);
      const previousStatus = recoveryCase.status;
      assertValidTransition(previousStatus, CASE_STATUSES.PICKUP_FAILED);

      pickup.status = PICKUP_STATUSES.FAILED;
      failedPickup = await pickup.save({ session });
      recoveryCase.status = CASE_STATUSES.PICKUP_FAILED;
      recoveryCase.version += 1;
      await recoveryCase.save({ session });
      await createEvent(recoveryCase._id, CASE_STATUSES.PICKUP_FAILED, courier, {
        pickupId: pickup._id,
        previousStatus,
        ...(reason && { reason }),
      }, session);
    });
    return failedPickup;
  } finally {
    await session.endSession();
  }
};

export const getMyPickups = (courier) =>
  Pickup.find({ courierId: courier._id }).sort({ createdAt: -1 });
