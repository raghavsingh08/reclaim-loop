import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { USER_ROLE_VALUES } from '../constants/roles.js';

const appendOnlyError = (operation) => {
  const error = new Error(`Events are append-only; ${operation} is not allowed`);
  error.code = 'EVENT_APPEND_ONLY';
  return error;
};

const eventSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', required: true },
    type: { type: String, required: true, trim: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, enum: USER_ROLE_VALUES, required: true },
    schemaVersion: { type: Number, min: 1 },
    commandId: { type: String, trim: true },
    commandSequence: { type: Number, min: 1 },
    previousStatus: { type: String, trim: true },
    nextStatus: { type: String, trim: true },
    previousVersion: { type: Number, min: 0 },
    nextVersion: { type: Number, min: 0 },
    occurredAt: { type: Date },
    recordedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

eventSchema.index({ caseId: 1, createdAt: 1 });

eventSchema.pre('save', function rejectExistingDocumentSave() {
  if (!this.isNew) throw appendOnlyError('saving an existing Event');
});

eventSchema.pre(
  [
    'updateOne',
    'updateMany',
    'replaceOne',
    'findOneAndUpdate',
    'findOneAndReplace',
  ],
  function rejectEventUpdate() {
    throw appendOnlyError(this.op || 'updating Events');
  },
);

eventSchema.pre('bulkWrite', function rejectMutatingBulkWrite(_next, operations) {
  if (operations.some((operation) => !operation.insertOne)) {
    throw appendOnlyError('mutating Events through bulkWrite');
  }
});

const assertDevelopmentDeletion = function assertDevelopmentDeletion() {
  const explicitlyAllowed = this.getOptions().allowEventDevelopmentDeletion === true;
  if (env.nodeEnv === 'production' || !explicitlyAllowed) {
    throw appendOnlyError(this.op || 'deleting Events');
  }
};

eventSchema.pre(
  ['deleteOne', 'deleteMany', 'findOneAndDelete'],
  { query: true, document: false },
  assertDevelopmentDeletion,
);

eventSchema.pre(
  'deleteOne',
  { query: false, document: true },
  function rejectDocumentDeletion() {
    throw appendOnlyError('deleting an Event document');
  },
);

eventSchema.statics.deleteManyForDevelopment = function deleteManyForDevelopment(
  filter,
  { session } = {},
) {
  if (env.nodeEnv === 'production') {
    throw appendOnlyError('development Event cleanup in production');
  }

  const query = this.deleteMany(filter).setOptions({
    allowEventDevelopmentDeletion: true,
  });
  if (session) query.session(session);
  return query;
};

export const Event = mongoose.model('Event', eventSchema);
