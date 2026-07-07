# Event Audit Architecture

## Append-only principle

ReclaimLoop Events are historical facts. After an Event is inserted, application code must not change or remove it. Current case timelines, administrative activity, and parts of the refund workflow rely on Event history remaining trustworthy.

New lifecycle Events use audit schema version `1` and record command correlation when available, transition status boundaries, case version boundaries, and occurrence/recording timestamps. These fields remain optional at the database-schema level so historical Events continue to load unchanged.

The allowed production operation is:

```text
INSERT
```

The forbidden production operations are:

```text
UPDATE
REPLACE
DELETE
```

This includes query updates, replacements, saving an existing Event document, document deletion, and mutating bulk writes.

## Enforcement

The Event model rejects these Mongoose operations:

- `updateOne`
- `updateMany`
- `replaceOne`
- `findOneAndUpdate` and `findByIdAndUpdate`
- `findOneAndReplace`
- `save()` for an existing Event
- mutating `bulkWrite` operations
- query and document deletion

`create`, `insertMany`, and insert-only `bulkWrite` operations remain valid. Existing lifecycle workflows therefore continue appending Events without changing their response or transaction behavior.

The protection is an application-model boundary. It does not prevent a privileged database administrator or code using the raw MongoDB collection from modifying data. Production database credentials should ultimately enforce insert/read-only access to the Events collection.

## Development cleanup

Automated development flows need to remove disposable cases and their related records. The case deletion route is registered only when `NODE_ENV` is not `production`.

Development cleanup uses the explicit `Event.deleteManyForDevelopment()` model method. That method and its query middleware both reject execution in production. Normal application code cannot call `Event.deleteMany()` directly.

The production admin frontend no longer exposes case deletion. Production lifecycle history is retained even though development environments can still clean isolated test records.

## Lifecycle audit fields

New Events appended by `CaseTransitionEngine` include:

- `schemaVersion`
- optional `commandId`
- `commandSequence`
- `previousStatus`
- `nextStatus`
- `previousVersion`
- `nextVersion`
- `occurredAt`
- `recordedAt`

Pickup Assignment and Assign Inspector propagate the UUID issued by `CommandCoordinator`. Uncoordinated legacy workflows omit `commandId` rather than inventing correlation, but still record status and version boundaries available to the transition engine.

Legacy records may omit every new field. Timeline consumers must continue treating these fields as optional.

## Future audit evolution

Append-only enforcement is the first invariant for the audit trail. Later phases can safely build on it by introducing:

- command correlation
- explicit previous and next lifecycle state
- version boundaries and stable ordering
- schema-versioned Event payloads
- tamper-evident hashes or checkpoints
- transactional Outbox records

The Event records business facts. A future Outbox will deliver side effects; it will not replace or weaken Event immutability.
