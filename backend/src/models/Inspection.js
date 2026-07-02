import mongoose from 'mongoose';
import {
  INSPECTION_CONDITION_VALUES,
  RECOMMENDED_OUTCOME_VALUES,
} from '../constants/inspectionValues.js';
import {
  INSPECTION_STATUSES,
  INSPECTION_STATUS_VALUES,
} from '../constants/inspectionStatus.js';

const inspectionImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const inspectionSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', required: true },
    inspectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
    status: {
      type: String,
      enum: INSPECTION_STATUS_VALUES,
      default: INSPECTION_STATUSES.ASSIGNED,
      required: true,
    },
    assignedAt: { type: Date, required: true, default: Date.now },
    startedAt: { type: Date, default: null },
    condition: { type: String, enum: INSPECTION_CONDITION_VALUES, default: null },
    notes: { type: String, trim: true, default: null },
    images: { type: [inspectionImageSchema], default: [] },
    recommendedOutcome: { type: String, enum: RECOMMENDED_OUTCOME_VALUES, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

inspectionSchema.index({ caseId: 1 });
inspectionSchema.index({ inspectorId: 1 });
inspectionSchema.index({ facilityId: 1 });

export const Inspection = mongoose.model('Inspection', inspectionSchema);
