import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  acceptPickup,
  assignPickup,
  collectPickup,
  failPickup,
  getMyPickups,
} from './pickup.service.js';

export const assign = asyncHandler(async (req, res) => {
  const pickup = await assignPickup(req.body, req.user);
  res.status(201).json(new ApiResponse(201, { pickup }, 'Pickup assigned'));
});

export const accept = asyncHandler(async (req, res) => {
  const pickup = await acceptPickup(req.params.pickupId, req.user);
  res.status(200).json(new ApiResponse(200, { pickup }, 'Pickup accepted'));
});

export const collect = asyncHandler(async (req, res) => {
  const pickup = await collectPickup(req.params.pickupId, req.body, req.user);
  res.status(200).json(new ApiResponse(200, { pickup }, 'Item collected'));
});

export const fail = asyncHandler(async (req, res) => {
  const pickup = await failPickup(req.params.pickupId, req.body, req.user);
  res.status(200).json(new ApiResponse(200, { pickup }, 'Pickup marked as failed'));
});

export const getMine = asyncHandler(async (req, res) => {
  const pickups = await getMyPickups(req.user);
  res.status(200).json(new ApiResponse(200, { pickups }, 'Assigned pickups retrieved'));
});
