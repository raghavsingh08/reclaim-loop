import mongoose from 'mongoose';
import { CASE_STATUSES, CASE_STATUS_VALUES } from '../constants/caseStatus.js';
import { OWNER_TYPES, OWNER_TYPE_VALUES } from '../constants/ownerTypes.js';
import { REQUEST_TYPE_VALUES } from '../constants/requestTypes.js';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, default: null },
    serialNumber: { type: String, trim: true, default: null },
    category: { type: String, trim: true, default: null },
    purchaseDate: { type: Date, default: null },
    orderId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const pickupAddressSchema = new mongoose.Schema(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: null },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const recoveryCaseSchema = new mongoose.Schema(
  {
    caseCode: { type: String, required: true, unique: true, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    retailerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    requestType: { type: String, enum: REQUEST_TYPE_VALUES, required: true },
    product: { type: productSchema, required: true },
    pickupAddress: { type: pickupAddressSchema, required: true },
    reason: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    status: { type: String, enum: CASE_STATUS_VALUES, default: CASE_STATUSES.CASE_CREATED },
    currentOwnerType: { type: String, enum: OWNER_TYPE_VALUES, default: OWNER_TYPES.CUSTOMER },
    currentOwnerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    assignedFacilityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    pickupId: { type: mongoose.Schema.Types.ObjectId, default: null },
    inspectionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    outcome: { type: mongoose.Schema.Types.Mixed, default: null },
    evidenceImages: { type: [String], default: [] },
    version: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

recoveryCaseSchema.index({ customerId: 1 });
recoveryCaseSchema.index({ status: 1 });
recoveryCaseSchema.index({ requestType: 1 });
recoveryCaseSchema.index({ 'product.serialNumber': 1 });

export const RecoveryCase = mongoose.model('RecoveryCase', recoveryCaseSchema);
