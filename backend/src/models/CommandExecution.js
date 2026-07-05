import mongoose from 'mongoose';

export const COMMAND_EXECUTION_STATUSES = Object.freeze({
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
});

const commandExecutionSchema = new mongoose.Schema(
  {
    commandId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    key: { type: String, required: true, immutable: true },
    method: { type: String, required: true, immutable: true },
    route: { type: String, required: true, immutable: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    requestHash: { type: String, required: true, immutable: true },
    status: {
      type: String,
      enum: Object.values(COMMAND_EXECUTION_STATUSES),
      default: COMMAND_EXECUTION_STATUSES.IN_PROGRESS,
      required: true,
    },
    responseStatus: { type: Number, default: null },
    responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
    lockedUntil: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

commandExecutionSchema.index(
  { userId: 1, method: 1, route: 1, key: 1 },
  { unique: true },
);
commandExecutionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
commandExecutionSchema.index({ status: 1, lockedUntil: 1 });

export const CommandExecution = mongoose.model(
  'CommandExecution',
  commandExecutionSchema,
);
