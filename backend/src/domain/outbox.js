import { logger as rootLogger } from '../config/logger.js';
import { OutboxMessage } from '../models/OutboxMessage.js';

const requireNonEmptyString = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
};

const enqueue = async ({
  session,
  type,
  aggregateType,
  aggregateId,
  commandId,
  deduplicationKey,
  payload,
  logger,
}) => {
  if (!session || typeof session.inTransaction !== 'function' || !session.inTransaction()) {
    throw new TypeError('Outbox.enqueue requires an active MongoDB transaction session');
  }

  const normalizedType = requireNonEmptyString(type, 'type');
  const normalizedAggregateType = requireNonEmptyString(
    aggregateType,
    'aggregateType',
  );
  if (aggregateId === undefined || aggregateId === null || !aggregateId.toString().trim()) {
    throw new TypeError('aggregateId is required');
  }
  const normalizedDeduplicationKey = requireNonEmptyString(
    deduplicationKey,
    'deduplicationKey',
  );
  if (commandId !== undefined && commandId !== null) {
    requireNonEmptyString(commandId, 'commandId');
  }
  if (payload === undefined) throw new TypeError('payload is required');

  const outboxLogger = (
    typeof logger?.child === 'function' ? logger : rootLogger
  ).child({ component: 'outbox' });

  const [message] = await OutboxMessage.create(
    [{
      type: normalizedType,
      aggregateType: normalizedAggregateType,
      aggregateId: aggregateId.toString().trim(),
      commandId: commandId?.trim() || null,
      deduplicationKey: normalizedDeduplicationKey,
      payload,
    }],
    { session },
  );

  outboxLogger.debug(
    {
      outcome: 'outbox_message_staged',
      outboxMessageId: message._id.toString(),
      type: message.type,
      aggregateType: message.aggregateType,
      aggregateId: message.aggregateId,
      ...(message.commandId && { commandId: message.commandId }),
      status: message.status,
      transactionState: 'active',
      dedupeKeyPresent: Boolean(deduplicationKey),
    },
    'Outbox message staged',
  );

  return message;
};

export const Outbox = Object.freeze({ enqueue });
