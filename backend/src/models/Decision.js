import mongoose from 'mongoose';
import { DECISION_TYPE_VALUES } from '../constants/decisionTypes.js';
import { RECOMMENDED_OUTCOME_VALUES } from '../constants/inspectionValues.js';

const decisionSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', required: true },
    recommendation: { type: String, enum: RECOMMENDED_OUTCOME_VALUES, required: true },
    decision: { type: String, enum: DECISION_TYPE_VALUES, required: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, trim: true, default: null },
    comments: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

decisionSchema.index({ caseId: 1 });
decisionSchema.index({ decidedBy: 1 });
decisionSchema.index({ decision: 1 });

export const Decision = mongoose.model('Decision', decisionSchema);
