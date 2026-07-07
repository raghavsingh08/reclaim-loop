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

  return message;
};

export const Outbox = Object.freeze({ enqueue });
