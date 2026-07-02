import mongoose from 'mongoose';
import { FACILITY_TYPE_VALUES } from '../constants/facilityTypes.js';

const locationSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const capacitySchema = new mongoose.Schema(
  {
    total: { type: Number, required: true, min: 0, default: 0 },
    reserved: { type: Number, required: true, min: 0, default: 0 },
    available: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const facilitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: FACILITY_TYPE_VALUES, required: true },
    location: { type: locationSchema, required: true },
    supportedCategories: { type: [String], default: [] },
    capacity: { type: capacitySchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

facilitySchema.index({ type: 1 });
facilitySchema.index({ 'location.pincode': 1 });
facilitySchema.index({ supportedCategories: 1 });

export const Facility = mongoose.model('Facility', facilitySchema);
