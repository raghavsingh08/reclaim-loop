import mongoose from 'mongoose';

const ledgerEntrySchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', required: true },
    type: {
      type: String,
      enum: ['REFUND_OBLIGATION'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },
    debitAccount: { type: String, required: true, trim: true },
    creditAccount: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'SETTLED', 'FAILED'],
      default: 'PENDING',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

ledgerEntrySchema.index({ caseId: 1 });
ledgerEntrySchema.index({ status: 1 });
ledgerEntrySchema.index({ type: 1 });
ledgerEntrySchema.index({ caseId: 1, type: 1 }, { unique: true });

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
