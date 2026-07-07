# Transactional Outbox Architecture

## Purpose

The Outbox provides a durable record of asynchronous work that must follow a committed business command. It closes the failure window where RecoveryCase state commits but an in-memory post-commit callback is lost because the process stops.

The Outbox is infrastructure, not the immutable business audit trail. An Event records what happened to a case. An OutboxMessage records work that must be delivered as a consequence.

## Transaction participation

Workflow code must enqueue through:

```js
await Outbox.enqueue({
  session,
  type,
  aggregateType,
  aggregateId,
  commandId,
  deduplicationKey,
  payload,
});
```

`enqueue()` requires an active MongoDB transaction session and inserts the OutboxMessage using that session. Business writes and delivery intent therefore share one commit or rollback together.

Direct `OutboxMessage.create()` calls are not part of the workflow API. Workflow services must depend on `Outbox.enqueue()` so a message cannot accidentally be persisted outside its business transaction.

## Message lifecycle

The initial lifecycle is:

```text
PENDING -> PROCESSING -> COMPLETED
```

New messages start as `PENDING`, with zero attempts and an immediately eligible `nextAttemptAt`. Lock, attempt, completion, and error fields exist for the future worker but are not used yet.

The unique `deduplicationKey` prevents the same logical delivery intent from being inserted more than once. Producers must eventually derive stable keys from a command ID or lifecycle Event ID plus the intended action and sequence.

## Embedded worker

The API process runs a small embedded worker. It atomically leases eligible messages, dispatches them after their originating transaction has committed, and marks them completed. Failed deliveries return to `PENDING` with exponential backoff, while expired `PROCESSING` leases can be recovered after a process interruption.

Only `CASE_UPDATED` is currently dispatched, through `EventPublisher`. Pickup Assignment is the only producer migrated to the Outbox. Other workflows retain their existing post-commit callbacks, and notification delivery is not yet migrated.

## Planned migration

The smallest planned migration is:

1. Migrate additional lifecycle `case:updated` producers after the Pickup Assignment pilot.
2. Migrate remaining workflow-specific socket events.
3. Persist Notifications within business transactions and enqueue `notification:new` delivery.
4. Add operational metrics and tuning for leasing, retries, and backlog depth.
5. Remove obsolete in-memory delivery callbacks after all producers migrate.

Redis, BullMQ, a separate worker process, and an Outbox-backed notification flow remain outside this foundation phase.
