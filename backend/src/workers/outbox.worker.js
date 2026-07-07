import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { EventPublisher } from '../domain/eventPublisher.js';
import { OutboxMessage, OUTBOX_STATUSES } from '../models/OutboxMessage.js';

const POLL_INTERVAL_MS = 1000;
const LOCK_TIMEOUT_MS = 30 * 1000;
const MAX_BATCH_SIZE = 20;
const MAX_BACKOFF_MS = 60 * 1000;
const workerId = `${hostname()}:${process.pid}:${randomUUID()}`;

let running = false;
let pollTimer;
let activeCycle = Promise.resolve();

const claimNextMessage = (now = new Date()) =>
  OutboxMessage.findOneAndUpdate(
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
    { new: true, sort: { createdAt: 1 } },
  );

const dispatch = async (message) => {
  if (message.type === 'CASE_UPDATED') {
    await EventPublisher.publishCaseUpdated(message.payload);
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

const markForRetry = (message, error) => OutboxMessage.updateOne(
  {
    _id: message._id,
    status: OUTBOX_STATUSES.PROCESSING,
    lockedBy: workerId,
  },
  {
    $set: {
      status: OUTBOX_STATUSES.PENDING,
      lastError: String(error?.message || error).slice(0, 2000),
      nextAttemptAt: new Date(Date.now() + retryDelay(message.attempts)),
      lockedAt: null,
      lockedBy: null,
    },
  },
);

const processMessage = async (message) => {
  try {
    await dispatch(message);
    await markCompleted(message);
  } catch (error) {
    await markForRetry(message, error);
    console.error(`Outbox delivery failed (${message.type}, attempt ${message.attempts}):`, error.message);
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
        console.error('Outbox polling failed:', error.message);
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
  console.log(`Outbox worker started (${workerId})`);
  scheduleNextCycle(0);
};

const stop = async () => {
  if (!running) return;
  running = false;
  clearTimeout(pollTimer);
  await activeCycle;
  console.log('Outbox worker stopped');
};

export const OutboxWorker = Object.freeze({ start, stop });
