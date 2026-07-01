import mongoose from 'mongoose';
import { OWNER_TYPE_VALUES } from '../constants/ownerTypes.js';
import { TRANSFER_TYPE_VALUES } from '../constants/transferTypes.js';

const proofSchema = new mongoose.Schema(
  {
    scanCode: { type: String, trim: true, default: null },
    imageUrl: { type: String, trim: true, default: null },
    note: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const custodyRecordSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', required: true },
    fromOwnerType: { type: String, enum: OWNER_TYPE_VALUES, required: true },
    fromOwnerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    toOwnerType: { type: String, enum: OWNER_TYPE_VALUES, required: true },
    toOwnerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    transferType: { type: String, enum: TRANSFER_TYPE_VALUES, required: true },
    proof: { type: proofSchema, default: () => ({}) },
    transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

custodyRecordSchema.index({ caseId: 1, createdAt: 1 });

export const CustodyRecord = mongoose.model('CustodyRecord', custodyRecordSchema);
