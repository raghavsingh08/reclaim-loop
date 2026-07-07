import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { CommandExecution, COMMAND_EXECUTION_STATUSES } from '../models/CommandExecution.js';
import { ApiError } from '../utils/ApiError.js';

const LOCK_DURATION_MS = 60 * 1000;
const RETENTION_DURATION_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{16,128}$/;

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
};

const createRequestHash = ({ method, route, params, body, userId }) =>
  createHash('sha256')
    .update(JSON.stringify(canonicalize({
      method: method.toUpperCase(),
      route,
      params: params || {},
      body: body || {},
      userId: userId.toString(),
    })))
    .digest('hex');

const validateKey = (key) => {
  if (!key) {
    throw new ApiError(
      400,
      'Idempotency-Key header is required',
      [],
      'IDEMPOTENCY_KEY_REQUIRED',
    );
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new ApiError(
      400,
      'Idempotency-Key must contain 16 to 128 printable non-space ASCII characters',
      [],
      'INVALID_IDEMPOTENCY_KEY',
    );
  }
};

const cloneForStorage = (value) => JSON.parse(JSON.stringify(value));

const runPostCommitActions = async (actions) => {
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      // Temporary in-memory delivery until a durable Outbox is introduced.
      // The database command is already committed, so delivery failure is logged only.
      console.error('Command post-commit action failed:', error);
    }
  }
};

const findExisting = ({ userId, method, route, key }) =>
  CommandExecution.findOne({ userId, method, route, key });

const resolveDuplicate = async ({
  userId,
  method,
  route,
  key,
  requestHash,
}) => {
  const existing = await findExisting({ userId, method, route, key });
  if (!existing) {
    // A unique-index race may become visible just after the losing insert fails.
    throw new ApiError(
      409,
      'A request with this idempotency key is already being processed.',
      [],
      'IDEMPOTENCY_IN_PROGRESS',
    );
  }
  if (existing.requestHash !== requestHash) {
    throw new ApiError(
      422,
      'This idempotency key was already used with a different request.',
      [],
      'IDEMPOTENCY_KEY_REUSED',
    );
  }
  if (existing.status === COMMAND_EXECUTION_STATUSES.COMPLETED) {
    return {
      commandId: existing.commandId,
      status: existing.responseStatus,
      body: existing.responseBody,
      replayed: true,
    };
  }
  throw new ApiError(
    409,
    'A request with this idempotency key is already being processed.',
    [],
    'IDEMPOTENCY_IN_PROGRESS',
  );
};

const execute = async ({ key, method, route, params = {}, body = {}, userId, work }) => {
  validateKey(key);
  if (!method || !route || !userId || typeof work !== 'function') {
    throw new TypeError('method, route, userId, and work are required');
  }

  const normalizedMethod = method.toUpperCase();
  const requestHash = createRequestHash({
    method: normalizedMethod,
    route,
    params,
    body,
    userId,
  });
  const now = Date.now();
  let execution;

  try {
    execution = await CommandExecution.create({
      commandId: randomUUID(),
      key,
      method: normalizedMethod,
      route,
      userId,
      requestHash,
      status: COMMAND_EXECUTION_STATUSES.IN_PROGRESS,
      lockedUntil: new Date(now + LOCK_DURATION_MS),
      expiresAt: new Date(now + RETENTION_DURATION_MS),
    });
  } catch (error) {
    const isScopeCollision =
      error?.code === 11000 &&
      error?.keyPattern?.userId &&
      error?.keyPattern?.method &&
      error?.keyPattern?.route &&
      error?.keyPattern?.key;
    if (!isScopeCollision) throw error;
    return resolveDuplicate({
      userId,
      method: normalizedMethod,
      route,
      key,
      requestHash,
    });
  }

  const session = await mongoose.startSession();
  const postCommitActions = [];
  try {
    session.startTransaction();
    const result = await work({
      session,
      commandId: execution.commandId,
      afterCommit: (action) => {
        if (typeof action !== 'function') {
          throw new TypeError('afterCommit action must be a function');
        }
        postCommitActions.push(action);
      },
    });
    if (!Number.isInteger(result?.status) || result.status < 200 || result.status >= 400) {
      throw new TypeError('Command work must return a successful HTTP status and body');
    }

    const responseBody = cloneForStorage(result.body);
    const completedExecution = await CommandExecution.findOneAndUpdate(
      {
        _id: execution._id,
        status: COMMAND_EXECUTION_STATUSES.IN_PROGRESS,
        requestHash,
      },
      {
        $set: {
          status: COMMAND_EXECUTION_STATUSES.COMPLETED,
          responseStatus: result.status,
          responseBody,
          lockedUntil: new Date(),
        },
      },
      { new: true, runValidators: true, session },
    );
    if (!completedExecution) {
      throw new Error('Command execution ownership was lost before completion');
    }

    await session.commitTransaction();
    await runPostCommitActions(postCommitActions);

    return {
      commandId: completedExecution.commandId,
      status: result.status,
      body: responseBody,
      replayed: false,
    };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    // V1 deliberately stores no failed command result. The same key may execute again.
    await CommandExecution.deleteOne({
      _id: execution._id,
      status: COMMAND_EXECUTION_STATUSES.IN_PROGRESS,
    }).catch((cleanupError) => {
      console.error('Failed to clean up unsuccessful command execution:', cleanupError);
    });
    throw error;
  } finally {
    await session.endSession();
  }
};

export const CommandCoordinator = Object.freeze({ execute });
