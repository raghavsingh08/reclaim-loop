import mongoose from 'mongoose';
import { PICKUP_STATUSES, PICKUP_STATUS_VALUES } from '../constants/pickupStatus.js';

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

const scheduledWindowSchema = new mongoose.Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  { _id: false },
);

const pickupSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
    pickupAddress: { type: pickupAddressSchema, required: true },
    status: { type: String, enum: PICKUP_STATUS_VALUES, default: PICKUP_STATUSES.ASSIGNED },
    scheduledWindow: { type: scheduledWindowSchema, required: true },
    acceptedAt: { type: Date, default: null },
    collectedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    deliveryProof: {
      scanCode: { type: String, trim: true },
      note: { type: String, trim: true },
      imageUrl: { type: String, trim: true }
    }
  },
  { timestamps: true },
);

pickupSchema.index({ courierId: 1, status: 1 });

export const Pickup = mongoose.model('Pickup', pickupSchema);
