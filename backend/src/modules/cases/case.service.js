import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { REQUEST_TYPE_VALUES } from '../../constants/requestTypes.js';
import { USER_ROLES } from '../../constants/roles.js';
import { Outbox } from '../../domain/outbox.js';
import { CustodyRecord } from '../../models/CustodyRecord.js';
import { Decision } from '../../models/Decision.js';
import { Event } from '../../models/Event.js';
import { Inspection } from '../../models/Inspection.js';
import { LedgerEntry } from '../../models/LedgerEntry.js';
import { Notification } from '../../models/Notification.js';
import { Pickup } from '../../models/Pickup.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { ApiError } from '../../utils/ApiError.js';
import { createNotification } from '../notifications/notification.service.js';

const DEFAULT_CASE_LIMIT = 25;
const MAX_CASE_LIMIT = 100;
const CASE_CURSOR_VERSION = 1;
const DEFAULT_TIMELINE_LIMIT = 25;
const MAX_TIMELINE_LIMIT = 100;
const TIMELINE_CURSOR_VERSION = 1;

const parseCaseLimit = (value) => {
  if (value === undefined) return DEFAULT_CASE_LIMIT;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ApiError(400, 'Case limit must be an integer between 1 and 100');
  }

  const limit = Number(value);
  if (limit < 1 || limit > MAX_CASE_LIMIT) {
    throw new ApiError(400, 'Case limit must be an integer between 1 and 100');
  }
  return limit;
};

const encodeCaseCursor = ({ createdAt, _id }) => Buffer.from(JSON.stringify({
  v: CASE_CURSOR_VERSION,
  createdAt: createdAt.toISOString(),
  id: _id.toString(),
})).toString('base64url');

const decodeCaseCursor = (value) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new ApiError(400, 'Invalid case cursor');
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const createdAt = new Date(decoded.createdAt);
    if (
      decoded.v !== CASE_CURSOR_VERSION ||
      typeof decoded.createdAt !== 'string' ||
      Number.isNaN(createdAt.getTime()) ||
      typeof decoded.id !== 'string' ||
      !mongoose.isValidObjectId(decoded.id)
    ) {
      throw new Error('Invalid cursor payload');
    }
    return { createdAt, id: new mongoose.Types.ObjectId(decoded.id) };
  } catch {
    throw new ApiError(400, 'Invalid case cursor');
  }
};

const parseTimelineLimit = (value) => {
  if (value === undefined) return DEFAULT_TIMELINE_LIMIT;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ApiError(400, 'Timeline limit must be an integer between 1 and 100');
  }

  const limit = Number(value);
  if (limit < 1 || limit > MAX_TIMELINE_LIMIT) {
    throw new ApiError(400, 'Timeline limit must be an integer between 1 and 100');
  }
  return limit;
};

const encodeTimelineCursor = ({ createdAt, _id }) => Buffer.from(JSON.stringify({
  v: TIMELINE_CURSOR_VERSION,
  createdAt: createdAt.toISOString(),
  id: _id.toString(),
})).toString('base64url');

const decodeTimelineCursor = (value) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new ApiError(400, 'Invalid timeline cursor');
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const createdAt = new Date(decoded.createdAt);
    if (
      decoded.v !== TIMELINE_CURSOR_VERSION ||
      typeof decoded.createdAt !== 'string' ||
      Number.isNaN(createdAt.getTime()) ||
      typeof decoded.id !== 'string' ||
      !mongoose.isValidObjectId(decoded.id)
    ) {
      throw new Error('Invalid cursor payload');
    }
    return { createdAt, id: new mongoose.Types.ObjectId(decoded.id) };
  } catch {
    throw new ApiError(400, 'Invalid timeline cursor');
  }
};

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

  const session = await mongoose.startSession();
  let recoveryCase;
  try {
    await session.withTransaction(async () => {
      [recoveryCase] = await RecoveryCase.create(
        [{
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
        }],
        { session },
      );

      const occurredAt = new Date();
      const [event] = await Event.create(
        [{
          caseId: recoveryCase._id,
          type: CASE_STATUSES.CASE_CREATED,
          actorId: user._id,
          actorRole: user.role,
          schemaVersion: 1,
          commandSequence: 1,
          previousStatus: null,
          nextStatus: CASE_STATUSES.CASE_CREATED,
          previousVersion: null,
          nextVersion: recoveryCase.version,
          occurredAt,
          recordedAt: new Date(),
          metadata: {
            requestType,
            productName: recoveryCase.product.name,
            ...(recoveryCase.product.category && {
              category: recoveryCase.product.category,
            }),
          },
        }],
        { session },
      );

      await Outbox.enqueue({
        session,
        type: 'CASE_UPDATED',
        aggregateType: 'RecoveryCase',
        aggregateId: recoveryCase._id,
        commandId: undefined,
        deduplicationKey: `${event._id}:CASE_UPDATED`,
        payload: {
          caseId: recoveryCase._id.toString(),
          customerId: recoveryCase.customerId.toString(),
          status: recoveryCase.status,
          version: recoveryCase.version,
          actorId: user._id.toString(),
          actorRole: user.role,
          timestamp: occurredAt.toISOString(),
          metadata: { requestType },
        },
      });

      await createNotification({
        userId: user._id,
        caseId: recoveryCase._id,
        type: CASE_STATUSES.CASE_CREATED,
        title: 'Recovery case created',
        message: 'Recovery case ' + recoveryCase.caseCode + ' was created successfully.',
        metadata: { caseCode: recoveryCase.caseCode },
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  return recoveryCase;
};

export const listCases = async (user, { limit: rawLimit, cursor: rawCursor } = {}) => {
  const limit = parseCaseLimit(rawLimit);
  const filter = { ...accessFilter(user) };

  if (rawCursor !== undefined) {
    const cursor = decodeCaseCursor(rawCursor);
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ];
  }

  const results = await RecoveryCase.find(filter)
    .select('_id caseCode customerId product requestType status createdAt updatedAt')
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasNextPage = results.length > limit;
  const cases = hasNextPage ? results.slice(0, limit) : results;
  const lastCase = cases.at(-1);

  return {
    cases,
    pageInfo: {
      nextCursor: hasNextPage && lastCase ? encodeCaseCursor(lastCase) : null,
      hasNextPage,
    },
  };
};

export const getCaseById = (caseId, user) => findAccessibleCase(caseId, user);

export const getCaseTimeline = async (caseId, user, { limit: rawLimit, cursor: rawCursor } = {}) => {
  const recoveryCase = await findAccessibleCase(caseId, user);
  const limit = parseTimelineLimit(rawLimit);
  const filter = { caseId: recoveryCase._id };

  if (rawCursor !== undefined) {
    const cursor = decodeTimelineCursor(rawCursor);
    filter.$or = [
      { createdAt: { $gt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $gt: cursor.id } },
    ];
  }

  const results = await Event.find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .limit(limit + 1)
    .lean();
  const hasNextPage = results.length > limit;
  const events = hasNextPage ? results.slice(0, limit) : results;
  const lastEvent = events.at(-1);

  return {
    events,
    pageInfo: {
      nextCursor: hasNextPage && lastEvent ? encodeTimelineCursor(lastEvent) : null,
      hasNextPage,
    },
  };
};

export const getCaseCustody = async (caseId, user) => {
  const recoveryCase = await findAccessibleCase(caseId, user);
  return CustodyRecord.find({ caseId: recoveryCase._id }).sort({ createdAt: 1 }).lean();
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
      await Event.deleteManyForDevelopment(
        { caseId: recoveryCase._id },
        { session },
      );
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
