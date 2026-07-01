import mongoose from 'mongoose';
import { USER_ROLE_VALUES } from '../constants/roles.js';

const eventSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', required: true },
    type: { type: String, required: true, trim: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, enum: USER_ROLE_VALUES, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

eventSchema.index({ caseId: 1, createdAt: 1 });

export const Event = mongoose.model('Event', eventSchema);
