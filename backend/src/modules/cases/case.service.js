import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { REQUEST_TYPES, REQUEST_TYPE_VALUES } from '../../constants/requestTypes.js';
import { USER_ROLES } from '../../constants/roles.js';
import { CustodyRecord } from '../../models/CustodyRecord.js';
import { Decision } from '../../models/Decision.js';
import { Event } from '../../models/Event.js';
import { Inspection } from '../../models/Inspection.js';
import { LedgerEntry } from '../../models/LedgerEntry.js';
import { Notification } from '../../models/Notification.js';
import { Pickup } from '../../models/Pickup.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertValidTransition } from './caseStateMachine.js';
import { createNotification } from '../notifications/notification.service.js';

const createCaseCode = () =>
  `RC-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

const accessFilter = (user) =>
  user.role === USER_ROLES.CUSTOMER ? { customerId: user._id } : {};

const findAccessibleCase = async (caseId, user, session = null) => {
  if (!mongoose.isValidObjectId(caseId)) throw new ApiError(400, 'Invalid case ID');
  const recoveryCase = await RecoveryCase.findOne({ _id: caseId, ...accessFilter(user) }).session(session);
  if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');
  return recoveryCase;
};

const branchEntryStatuses = {
  [REQUEST_TYPES.REFUND]: CASE_STATUSES.REFUND_REVIEW_PENDING,
  [REQUEST_TYPES.REPAIR]: CASE_STATUSES.REPAIR_SCHEDULED,
  [REQUEST_TYPES.EXCHANGE]: CASE_STATUSES.REPLACEMENT_RESERVED,
  [REQUEST_TYPES.RECYCLE]: CASE_STATUSES.RECYCLE_SCHEDULED,
};

export const createCase = async (input, user) => {
  const { requestType, product, reason, description, retailerId, evidenceImages, pickupAddress } = input;
  if (!requestType || !product?.name?.trim() || !reason?.trim()) {
    throw new ApiError(400, 'Request type, product name, and reason are required');
  }
  if (
    !pickupAddress?.line1?.trim() ||
    !pickupAddress?.city?.trim() ||
    !pickupAddress?.state?.trim() ||
    !pickupAddress?.pincode?.trim()
  ) {
    throw new ApiError(400, 'Pickup address line1, city, state, and pincode are required');
  }
  if (!REQUEST_TYPE_VALUES.includes(requestType)) {
    throw new ApiError(400, `Request type must be one of: ${REQUEST_TYPE_VALUES.join(', ')}`);
  }

  const recoveryCase = await RecoveryCase.create({
    caseCode: createCaseCode(),
    customerId: user._id,
    retailerId: retailerId || null,
    requestType,
    product,
    pickupAddress,
    reason: reason.trim(),
    description: description?.trim() || null,
    currentOwnerId: user._id,
    evidenceImages: evidenceImages || [],
  });

  try {
    await Event.create({
      caseId: recoveryCase._id,
      type: CASE_STATUSES.CASE_CREATED,
      actorId: user._id,
      actorRole: user.role,
      metadata: { requestType },
    });
  } catch (error) {
    await RecoveryCase.findByIdAndDelete(recoveryCase._id);
    throw error;
  }

  await createNotification({
    userId: user._id,
    caseId: recoveryCase._id,
    type: CASE_STATUSES.CASE_CREATED,
    title: 'Recovery case created',
    message: 'Recovery case ' + recoveryCase.caseCode + ' was created successfully.',
    metadata: { caseCode: recoveryCase.caseCode },
  });

  return recoveryCase;
};

export const listCases = (user) =>
  RecoveryCase.find(accessFilter(user)).sort({ createdAt: -1 });

export const getCaseById = (caseId, user) => findAccessibleCase(caseId, user);

export const updateCaseStatus = async (caseId, { status, metadata }, user) => {
  if (!status) throw new ApiError(400, 'Status is required');

  const session = await mongoose.startSession();
  try {
    let updatedCase;
    await session.withTransaction(async () => {
      const recoveryCase = await findAccessibleCase(caseId, user, session);
      assertValidTransition(recoveryCase.status, status);

      if (
        recoveryCase.status === CASE_STATUSES.INSPECTION_COMPLETED &&
        branchEntryStatuses[recoveryCase.requestType] !== status
      ) {
        throw new ApiError(409, `The ${recoveryCase.requestType} workflow must transition to ${branchEntryStatuses[recoveryCase.requestType]}`);
      }

      const previousStatus = recoveryCase.status;
      recoveryCase.status = status;
      recoveryCase.version += 1;
      updatedCase = await recoveryCase.save({ session });

      await Event.create(
        [{
          caseId: recoveryCase._id,
          type: status,
          actorId: user._id,
          actorRole: user.role,
          metadata: { ...(metadata || {}), previousStatus },
        }],
        { session },
      );
    });
    return updatedCase;
  } finally {
    await session.endSession();
  }
};

export const getCaseTimeline = async (caseId, user) => {
  const recoveryCase = await findAccessibleCase(caseId, user);
  return Event.find({ caseId: recoveryCase._id }).sort({ createdAt: 1 });
};

export const getCaseCustody = async (caseId, user) => {
  const recoveryCase = await findAccessibleCase(caseId, user);
  return CustodyRecord.find({ caseId: recoveryCase._id }).sort({ createdAt: 1 });
};

// Development/testing-only hard delete. This intentionally removes the case and related test data.
export const deleteCaseForTesting = async (caseId) => {
  if (!mongoose.isValidObjectId(caseId)) throw new ApiError(400, 'Invalid case ID');

  const session = await mongoose.startSession();
  try {
    let deletedCaseId;
    await session.withTransaction(async () => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');

      deletedCaseId = recoveryCase._id;
      await Event.deleteMany({ caseId: recoveryCase._id }).session(session);
      await Pickup.deleteMany({ caseId: recoveryCase._id }).session(session);
      await Inspection.deleteMany({ caseId: recoveryCase._id }).session(session);
      await CustodyRecord.deleteMany({ caseId: recoveryCase._id }).session(session);
      await LedgerEntry.deleteMany({ caseId: recoveryCase._id }).session(session);
      await Decision.deleteMany({ caseId: recoveryCase._id }).session(session);
      await Notification.deleteMany({ caseId: recoveryCase._id }).session(session);
      await RecoveryCase.deleteOne({ _id: recoveryCase._id }).session(session);
    });

    return { caseId: deletedCaseId, deleted: true };
  } finally {
    await session.endSession();
  }
};
