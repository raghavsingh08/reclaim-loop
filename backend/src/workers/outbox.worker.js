import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { logger } from '../config/logger.js';
import { EventPublisher } from '../domain/eventPublisher.js';
import { OutboxMessage, OUTBOX_STATUSES } from '../models/OutboxMessage.js';

const POLL_INTERVAL_MS = 1000;
const LOCK_TIMEOUT_MS = 30 * 1000;
const MAX_BATCH_SIZE = 20;
const MAX_BACKOFF_MS = 60 * 1000;
const workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
const workerLogger = logger.child({ component: 'outbox-worker', workerId });

let running = false;
let pollTimer;
let activeCycle = Promise.resolve();

const messageLogFields = (message, status = message.status) => ({
  outboxMessageId: message._id.toString(),
  type: message.type,
  aggregateType: message.aggregateType,
  aggregateId: message.aggregateId,
  commandId: message.commandId || undefined,
  attempt: message.attempts,
  status,
});

const claimNextMessage = async (now = new Date()) => {
  const message = await OutboxMessage.findOneAndUpdate(
    {
      $or: [
        {
          status: OUTBOX_STATUSES.PENDING,
          nextAttemptAt: { $lte: now },
        },
        {
          status: OUTBOX_STATUSES.PROCESSING,
          lockedAt: { $lte: new Date(now.getTime() - LOCK_TIMEOUT_MS) },
        },
      ],
    },
    {
      $set: {
        status: OUTBOX_STATUSES.PROCESSING,
        lockedAt: now,
        lockedBy: workerId,
      },
      $inc: { attempts: 1 },
    },
    // Return the pre-claim document so stale PROCESSING leases can be identified
    // without a second, race-prone read. The update itself remains atomic.
    { new: false, sort: { createdAt: 1 } },
  );

  if (!message) return null;
  const recoveredStaleLock = message.status === OUTBOX_STATUSES.PROCESSING;
  message.status = OUTBOX_STATUSES.PROCESSING;
  message.lockedAt = now;
  message.lockedBy = workerId;
  message.attempts += 1;

  if (recoveredStaleLock) {
    workerLogger.warn(
      messageLogFields(message),
      'Recovered stale Outbox message lock',
    );
  }
  return message;
};

const dispatch = async (message) => {
  if (message.type === 'CASE_UPDATED') {
    await EventPublisher.publishCaseUpdated(message.payload);
    return;
  }
  if (message.type === 'PICKUP_ASSIGNED') {
    await EventPublisher.publishPickupAssigned(message.payload);
    return;
  }
  if (message.type === 'INSPECTION_ASSIGNED') {
    await EventPublisher.publishInspectionAssigned(message.payload);
    return;
  }
  if (message.type === 'PICKUP_ACCEPTED') {
    await EventPublisher.publishPickupAccepted(message.payload);
    return;
  }
  if (message.type === 'INSPECTION_STARTED') {
    await EventPublisher.publishInspectionStarted(message.payload);
    return;
  }
  if (message.type === 'INSPECTION_COMPLETED') {
    await EventPublisher.publishInspectionCompleted(message.payload);
    return;
  }
  if (message.type === 'NOTIFICATION_NEW') {
    await EventPublisher.publishNotificationNew(message.payload);
    return;
  }
  throw new Error(`Unsupported Outbox message type: ${message.type}`);
};

const markCompleted = (message) => OutboxMessage.updateOne(
  {
    _id: message._id,
    status: OUTBOX_STATUSES.PROCESSING,
    lockedBy: workerId,
  },
  {
    $set: {
      status: OUTBOX_STATUSES.COMPLETED,
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  },
);

const retryDelay = (attempts) => Math.min(
  1000 * (2 ** Math.max(0, attempts - 1)),
  MAX_BACKOFF_MS,
);

const markForRetry = (message, error, nextAttemptAt) => OutboxMessage.updateOne(
  {
    _id: message._id,
    status: OUTBOX_STATUSES.PROCESSING,
    lockedBy: workerId,
  },
  {
    $set: {
      status: OUTBOX_STATUSES.PENDING,
      lastError: String(error?.message || error).slice(0, 2000),
      nextAttemptAt,
      lockedAt: null,
      lockedBy: null,
    },
  },
);

const processMessage = async (message) => {
  workerLogger.debug(messageLogFields(message), 'Processing Outbox message');
  try {
    await dispatch(message);
    await markCompleted(message);
    workerLogger.debug(
      messageLogFields(message, OUTBOX_STATUSES.COMPLETED),
      'Outbox message delivered',
    );
  } catch (error) {
    const lastError = String(error?.message || error).slice(0, 2000);
    const nextAttemptAt = new Date(Date.now() + retryDelay(message.attempts));
    await markForRetry(message, error, nextAttemptAt);
    workerLogger.warn(
      {
        ...messageLogFields(message, OUTBOX_STATUSES.PENDING),
        lastError,
        nextAttemptAt,
        attempts: message.attempts,
      },
      'Outbox delivery failed; retry scheduled',
    );
  }
};

const processBatch = async () => {
  for (let processed = 0; processed < MAX_BATCH_SIZE && running; processed += 1) {
    const message = await claimNextMessage();
    if (!message) break;
    await processMessage(message);
  }
};

const scheduleNextCycle = (delay = POLL_INTERVAL_MS) => {
  pollTimer = setTimeout(() => {
    activeCycle = (async () => {
      try {
        await processBatch();
      } catch (error) {
        workerLogger.error({ err: error }, 'Outbox polling failed');
      } finally {
        if (running) scheduleNextCycle();
      }
    })();
  }, delay);
  pollTimer.unref();
};

const start = () => {
  if (running) return;
  running = true;
  workerLogger.info('Outbox worker started');
  scheduleNextCycle(0);
};

const stop = async () => {
  if (!running) return;
  running = false;
  workerLogger.info('Outbox worker shutdown requested');
  clearTimeout(pollTimer);
  await activeCycle;
  workerLogger.info('Outbox worker stopped');
};

export const OutboxWorker = Object.freeze({ start, stop });
