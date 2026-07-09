import mongoose from 'mongoose';
import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { OWNER_TYPES } from '../../constants/ownerTypes.js';
import { PICKUP_STATUSES } from '../../constants/pickupStatus.js';
import { USER_ROLES } from '../../constants/roles.js';
import { TRANSFER_TYPES } from '../../constants/transferTypes.js';
import { CaseEngine } from '../../domain/caseEngine.js';
import { CaseTransitionEngine } from '../../domain/caseTransitionEngine.js';
import { Outbox } from '../../domain/outbox.js';
import { CustodyRecord } from '../../models/CustodyRecord.js';
import { Facility } from '../../models/Facility.js';
import { Pickup } from '../../models/Pickup.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  createAdminNotifications,
  createNotification,
} from '../notifications/notification.service.js';

const DEFAULT_PICKUP_LIMIT = 25;
const MAX_PICKUP_LIMIT = 100;
const PICKUP_CURSOR_VERSION = 1;

const parsePickupLimit = (value) => {
  if (value === undefined) return DEFAULT_PICKUP_LIMIT;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ApiError(400, 'Pickup limit must be an integer between 1 and 100');
  }

  const limit = Number(value);
  if (limit < 1 || limit > MAX_PICKUP_LIMIT) {
    throw new ApiError(400, 'Pickup limit must be an integer between 1 and 100');
  }
  return limit;
};

const encodePickupCursor = ({ createdAt, _id }) => Buffer.from(JSON.stringify({
  v: PICKUP_CURSOR_VERSION,
  createdAt: createdAt.toISOString(),
  id: _id.toString(),
})).toString('base64url');

const decodePickupCursor = (value) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new ApiError(400, 'Invalid pickup cursor');
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const createdAt = new Date(decoded.createdAt);
    if (
      decoded.v !== PICKUP_CURSOR_VERSION ||
      typeof decoded.createdAt !== 'string' ||
      Number.isNaN(createdAt.getTime()) ||
      typeof decoded.id !== 'string' ||
      !mongoose.isValidObjectId(decoded.id)
    ) {
      throw new Error('Invalid cursor payload');
    }
    return { createdAt, id: new mongoose.Types.ObjectId(decoded.id) };
  } catch {
    throw new ApiError(400, 'Invalid pickup cursor');
  }
};

const requireObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(400, `Invalid ${label}`);
};

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

export const assignPickup = async (
  input,
  actor,
  { session, commandId, afterCommit, logger } = {},
) => {
  const { caseId, courierId, facilityId, scheduledWindow } = input;
  if (!caseId || !courierId || !facilityId || !scheduledWindow?.start || !scheduledWindow?.end) {
    throw new ApiError(400, 'Case ID, courier ID, facility ID, and scheduled window are required');
  }
  requireObjectId(caseId, 'case ID');
  requireObjectId(courierId, 'courier ID');
  requireObjectId(facilityId, 'facility ID');

  const windowStart = new Date(scheduledWindow.start);
  const windowEnd = new Date(scheduledWindow.end);
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime()) || windowEnd <= windowStart) {
    throw new ApiError(400, 'Scheduled window must contain valid dates with end after start');
  }

  let assignedPickup;
  if (!session || typeof afterCommit !== 'function') {
    throw new TypeError('Pickup assignment requires a coordinated transaction context');
  }

  await CaseTransitionEngine.executeOptimistic({
    session,
    afterCommit,
    work: async ({ session }) => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');

      const expectedStatus = recoveryCase.status;
      const expectedVersion = recoveryCase.version;

      const courier = await User.findOne({
        _id: courierId,
        role: USER_ROLES.COURIER,
        isActive: true,
      }).select('_id role isActive').session(session);
      const facility = await Facility.findOne({
        _id: facilityId,
        isActive: true,
      }).select('_id isActive').session(session);
      if (!recoveryCase.pickupAddress) throw new ApiError(400, 'Recovery case is missing a pickup address. Cannot assign courier.');
      if (!courier) throw new ApiError(400, 'Courier must be an active COURIER user');
      if (!facility) throw new ApiError(400, 'Facility must be an active facility');
      if (recoveryCase.pickupId) throw new ApiError(409, 'A pickup is already assigned to this case');

      const pickupId = new mongoose.Types.ObjectId();

      const updatedCase = await CaseTransitionEngine.transitionOptimistic({
        caseId: recoveryCase._id,
        expectedStatus,
        expectedVersion,
        nextStatus: CASE_STATUSES.PICKUP_ASSIGNED,
        actor: {
          id: actor._id,
          role: actor.role,
        },
        casePatch: {
          pickupId,
          assignedFacilityId: facility._id,
          currentOwnerType: OWNER_TYPES.CUSTOMER,
          currentOwnerId: recoveryCase.customerId,
        },
        metadata: {
          pickupId,
          courierId: courier._id,
          facilityId: facility._id,
          previousStatus: CASE_STATUSES.CASE_CREATED,
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

      [assignedPickup] = await Pickup.create(
        [{
          _id: pickupId,
          caseId: recoveryCase._id,
          customerId: recoveryCase.customerId,
          courierId: courier._id,
          facilityId: facility._id,
          pickupAddress: recoveryCase.pickupAddress,
          scheduledWindow: { start: windowStart, end: windowEnd },
        }],
        { session },
      );

      await Outbox.enqueue({
        session,
        type: 'PICKUP_ASSIGNED',
        aggregateType: 'Pickup',
        aggregateId: assignedPickup._id,
        commandId,
        deduplicationKey: `${commandId}:PICKUP_ASSIGNED:${assignedPickup._id}`,
        payload: {
          caseId: assignedPickup.caseId.toString(),
          pickupId: assignedPickup._id.toString(),
          customerId: assignedPickup.customerId.toString(),
          courierId: assignedPickup.courierId.toString(),
          status: assignedPickup.status,
          timestamp: new Date().toISOString(),
        },
        logger,
      });

      await createNotification({
        userId: assignedPickup.courierId,
        caseId: assignedPickup.caseId,
        type: CASE_STATUSES.PICKUP_ASSIGNED,
        title: 'New pickup assigned',
        message: 'A new recovery pickup has been assigned to you.',
        metadata: { pickupId: assignedPickup._id },
        session,
        commandId,
        logger,
      });

      await createNotification({
        userId: assignedPickup.customerId,
        caseId: assignedPickup.caseId,
        type: CASE_STATUSES.PICKUP_ASSIGNED,
        title: 'Pickup assigned',
        message: 'A courier has been assigned to collect your item.',
        metadata: { pickupId: assignedPickup._id },
        session,
        commandId,
        logger,
      });
    },
  });
  return assignedPickup;
};

export const acceptPickup = async (pickupId, courier) => {
  let acceptedPickup;
  await CaseEngine.runInTransaction(async (session) => {
      const pickup = await getCourierPickup(pickupId, courier._id, session);
      if (pickup.status !== PICKUP_STATUSES.ASSIGNED) {
        throw new ApiError(409, 'Only an assigned pickup can be accepted');
      }
      const recoveryCase = await getPickupCase(pickup, session);
      pickup.status = PICKUP_STATUSES.ACCEPTED;
      pickup.acceptedAt = new Date();
      acceptedPickup = await pickup.save({ session });
      await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.PICKUP_ACCEPTED,
        actorId: courier._id,
        actorRole: courier.role,
        metadata: {
          pickupId: pickup._id,
          previousStatus: CASE_STATUSES.PICKUP_ASSIGNED,
        },
      });

      await Outbox.enqueue({
        session,
        type: 'PICKUP_ACCEPTED',
        aggregateType: 'Pickup',
        aggregateId: acceptedPickup._id,
        commandId: undefined,
        deduplicationKey: `${acceptedPickup._id}:PICKUP_ACCEPTED`,
        payload: {
          caseId: acceptedPickup.caseId.toString(),
          pickupId: acceptedPickup._id.toString(),
          customerId: acceptedPickup.customerId.toString(),
          courierId: acceptedPickup.courierId.toString(),
          status: acceptedPickup.status,
          timestamp: acceptedPickup.acceptedAt.toISOString(),
        },
      });

      await createNotification({
        userId: acceptedPickup.customerId,
        caseId: acceptedPickup.caseId,
        type: CASE_STATUSES.PICKUP_ACCEPTED,
        title: 'Courier accepted pickup',
        message: 'The assigned courier accepted your pickup.',
        metadata: { pickupId: acceptedPickup._id },
        session,
      });
  });
  return acceptedPickup;
};

export const collectPickup = async (pickupId, { proof } = {}, courier) => {
  let collectedPickup;
  await CaseEngine.runInTransaction(async (session) => {
      const pickup = await getCourierPickup(pickupId, courier._id, session);
      if (pickup.status !== PICKUP_STATUSES.ACCEPTED) {
        throw new ApiError(409, 'Only an accepted pickup can be collected');
      }
      const recoveryCase = await getPickupCase(pickup, session);
      pickup.status = PICKUP_STATUSES.COLLECTED;
      pickup.collectedAt = new Date();
      collectedPickup = await pickup.save({ session });

      recoveryCase.currentOwnerType = OWNER_TYPES.COURIER;
      recoveryCase.currentOwnerId = courier._id;
      await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.ITEM_COLLECTED,
        actorId: courier._id,
        actorRole: courier.role,
        metadata: {
          pickupId: pickup._id,
          previousStatus: CASE_STATUSES.PICKUP_ACCEPTED,
        },
      });

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

      await createAdminNotifications(
        {
          caseId: collectedPickup.caseId,
          type: CASE_STATUSES.ITEM_COLLECTED,
          title: 'Item collected',
          message: 'A recovery item was collected by its courier.',
          metadata: { pickupId: collectedPickup._id },
        },
        { session },
      );

      await createNotification({
        userId: collectedPickup.customerId,
        caseId: collectedPickup.caseId,
        type: CASE_STATUSES.ITEM_COLLECTED,
        title: 'Item collected by courier',
        message: 'Your item was collected by the courier.',
        metadata: { pickupId: collectedPickup._id },
        session,
      });
  });
  return collectedPickup;
};

export const deliverPickup = async (pickupId, { proof } = {}, courier) => {
  let deliveredPickup;
  await CaseEngine.runInTransaction(async (session) => {
      const pickup = await getCourierPickup(pickupId, courier._id, session);
      if (pickup.status !== PICKUP_STATUSES.COLLECTED) {
        throw new ApiError(409, 'Only a collected pickup can be delivered');
      }
      const recoveryCase = await getPickupCase(pickup, session);
      if (recoveryCase.status !== CASE_STATUSES.ITEM_COLLECTED) {
        throw new ApiError(409, 'Case must be in ITEM_COLLECTED status to be delivered');
      }
      if (
        !recoveryCase.assignedFacilityId ||
        !recoveryCase.assignedFacilityId.equals(pickup.facilityId)
      ) {
        throw new ApiError(409, 'Pickup destination does not match the case facility');
      }
      
      pickup.status = PICKUP_STATUSES.DELIVERED_TO_FACILITY;
      pickup.deliveredAt = new Date();
      if (proof && Object.keys(proof).length > 0) {
        pickup.deliveryProof = proof;
      }
      deliveredPickup = await pickup.save({ session });

      await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.DELIVERED_TO_FACILITY,
        actorId: courier._id,
        actorRole: courier.role,
        metadata: {
          pickupId: pickup._id,
          previousStatus: CASE_STATUSES.ITEM_COLLECTED,
        },
      });
      // Do not create custody record yet. That happens when facility receives it.
  });
  return deliveredPickup;
};

export const failPickup = async (pickupId, { reason } = {}, courier) => {
  let failedPickup;
  await CaseEngine.runInTransaction(async (session) => {
      const pickup = await getCourierPickup(pickupId, courier._id, session);
      if (![PICKUP_STATUSES.ASSIGNED, PICKUP_STATUSES.ACCEPTED].includes(pickup.status)) {
        throw new ApiError(409, 'Only an assigned or accepted pickup can be failed');
      }
      const recoveryCase = await getPickupCase(pickup, session);
      const previousStatus = recoveryCase.status;

      pickup.status = PICKUP_STATUSES.FAILED;
      failedPickup = await pickup.save({ session });
      await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.PICKUP_FAILED,
        actorId: courier._id,
        actorRole: courier.role,
        metadata: {
          pickupId: pickup._id,
          previousStatus,
          ...(reason && { reason }),
        },
      });
  });
  return failedPickup;
};

export const getMyPickups = async (courier, { limit: rawLimit, cursor: rawCursor } = {}) => {
  const limit = parsePickupLimit(rawLimit);
  const filter = { courierId: courier._id };

  if (rawCursor !== undefined) {
    const cursor = decodePickupCursor(rawCursor);
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ];
  }

  const results = await Pickup.find(filter)
    .populate('facilityId', 'name type location')
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasNextPage = results.length > limit;
  const pickups = hasNextPage ? results.slice(0, limit) : results;
  const lastPickup = pickups.at(-1);

  return {
    pickups,
    pageInfo: {
      nextCursor: hasNextPage && lastPickup ? encodePickupCursor(lastPickup) : null,
      hasNextPage,
    },
  };
};

export const getPickupById = async (pickupId, user) => {
  requireObjectId(pickupId, 'pickup ID');
  const query = { _id: pickupId };
  if (user.role === USER_ROLES.COURIER) {
    query.courierId = user._id;
  } else if (user.role !== USER_ROLES.ADMIN) {
    throw new ApiError(403, 'Unauthorized to view pickup details');
  }

  const pickup = await Pickup.findOne(query)
    .populate('facilityId', 'name type location')
    .lean();
  if (!pickup) {
    throw new ApiError(404, 'Pickup not found');
  }
  
  const recoveryCase = await RecoveryCase.findById(pickup.caseId).lean();
  return { pickup, recoveryCase, facility: pickup.facilityId };
};
