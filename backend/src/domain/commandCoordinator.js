import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { logger as rootLogger } from '../config/logger.js';
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

const runPostCommitActions = async (actions, log) => {
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const action = actions[actionIndex];
    try {
      await action();
    } catch (error) {
      // Temporary in-memory delivery until a durable Outbox is introduced.
      // The database command is already committed, so delivery failure is logged only.
      log.error(
        { err: error, actionIndex },
        'Command post-commit action failed',
      );
    }
  }
};

const stringifyId = (value) => value?.toString?.() || value;

const createCommandLogger = ({ context, route, userId, commandId }) => {
  const baseLogger = typeof context?.logger?.child === 'function'
    ? context.logger
    : rootLogger;
  return baseLogger.child({
    component: 'command-coordinator',
    ...(context?.requestId && { requestId: context.requestId }),
    ...(commandId && { commandId }),
    ...(context?.workflow && { workflow: context.workflow }),
    route: context?.route || route,
    userId: stringifyId(context?.userId || userId),
    ...(context?.role && { role: context.role }),
  });
};

const findExisting = ({ userId, method, route, key }) =>
  CommandExecution.findOne({ userId, method, route, key });

const resolveDuplicate = async ({
  userId,
  method,
  route,
  key,
  requestHash,
  log,
  startedAt,
}) => {
  const existing = await findExisting({ userId, method, route, key });
  if (!existing) {
    // A unique-index race may become visible just after the losing insert fails.
    log.warn(
      { outcome: 'in_progress', durationMs: Date.now() - startedAt },
      'Duplicate command is still in progress',
    );
    throw new ApiError(
      409,
      'A request with this idempotency key is already being processed.',
      [],
      'IDEMPOTENCY_IN_PROGRESS',
    );
  }
  const duplicateLog = log.child({ commandId: existing.commandId });
  if (existing.requestHash !== requestHash) {
    duplicateLog.warn(
      { outcome: 'request_hash_mismatch', durationMs: Date.now() - startedAt },
      'Idempotency key reused for a different request',
    );
    throw new ApiError(
      422,
      'This idempotency key was already used with a different request.',
      [],
      'IDEMPOTENCY_KEY_REUSED',
    );
  }
  if (existing.status === COMMAND_EXECUTION_STATUSES.COMPLETED) {
    duplicateLog.info(
      {
        outcome: 'replayed',
        responseStatus: existing.responseStatus,
        durationMs: Date.now() - startedAt,
      },
      'Completed command replayed',
    );
    return {
      commandId: existing.commandId,
      status: existing.responseStatus,
      body: existing.responseBody,
      replayed: true,
    };
  }
  duplicateLog.warn(
    { outcome: 'in_progress', durationMs: Date.now() - startedAt },
    'Duplicate command is still in progress',
  );
  throw new ApiError(
    409,
    'A request with this idempotency key is already being processed.',
    [],
    'IDEMPOTENCY_IN_PROGRESS',
  );
};

const execute = async ({
  key,
  method,
  route,
  params = {},
  body = {},
  userId,
  work,
  context = {},
}) => {
  const startedAt = Date.now();
  const contextLog = createCommandLogger({ context, route, userId });
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
      log: contextLog,
      startedAt,
    });
  }

  const commandLog = createCommandLogger({
    context,
    route,
    userId,
    commandId: execution.commandId,
  });
  commandLog.debug(
    { outcome: 'acquired', idempotencyKeyPresent: Boolean(key) },
    'Command acquired',
  );

  const session = await mongoose.startSession();
  const postCommitActions = [];
  try {
    session.startTransaction();
    commandLog.debug('Command transaction started');
    const result = await work({
      session,
      commandId: execution.commandId,
      logger: commandLog,
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
    commandLog.info(
      {
        outcome: 'committed',
        responseStatus: result.status,
        durationMs: Date.now() - startedAt,
      },
      'Command committed',
    );
    await runPostCommitActions(postCommitActions, commandLog);

    return {
      commandId: completedExecution.commandId,
      status: result.status,
      body: responseBody,
      replayed: false,
    };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    const rollbackFields = {
      outcome: 'rolled_back',
      durationMs: Date.now() - startedAt,
      ...(error?.code && { errorCode: error.code }),
      ...(error?.statusCode && { statusCode: error.statusCode }),
    };
    if (error?.isOperational || (error?.statusCode && error.statusCode < 500)) {
      commandLog.warn(rollbackFields, 'Command rolled back');
    } else {
      commandLog.warn(
        {
          ...rollbackFields,
          outcome: 'unexpected_rollback',
          errorType: error?.name || 'Error',
        },
        'Command rolled back unexpectedly',
      );
    }
    // V1 deliberately stores no failed command result. The same key may execute again.
    await CommandExecution.deleteOne({
      _id: execution._id,
      status: COMMAND_EXECUTION_STATUSES.IN_PROGRESS,
    }).catch((cleanupError) => {
      commandLog.error(
        { err: cleanupError },
        'Failed to clean up unsuccessful command execution',
      );
    });
    throw error;
  } finally {
    await session.endSession();
  }
};

export const CommandCoordinator = Object.freeze({ execute });
