import mongoose from 'mongoose';

export const OUTBOX_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
});

const outboxMessageSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    aggregateType: { type: String, required: true, trim: true },
    aggregateId: { type: String, required: true, trim: true },
    commandId: { type: String, trim: true, default: null },
    deduplicationKey: { type: String, required: true, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: Object.values(OUTBOX_STATUSES),
      default: OUTBOX_STATUSES.PENDING,
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0, required: true },
    nextAttemptAt: { type: Date, default: Date.now, required: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, trim: true, default: null },
    processedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

outboxMessageSchema.index({ deduplicationKey: 1 }, { unique: true });
outboxMessageSchema.index({ status: 1, nextAttemptAt: 1 });
outboxMessageSchema.index({ status: 1, lockedAt: 1 });

// Workflow code must use Outbox.enqueue() so insertion always participates in
// an existing business transaction. This model is infrastructure persistence.
export const OutboxMessage = mongoose.model('OutboxMessage', outboxMessageSchema);
