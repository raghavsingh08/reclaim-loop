import { CommandCoordinator } from '../../domain/commandCoordinator.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  acceptPickup,
  assignPickup,
  collectPickup,
  failPickup,
  getMyPickups,
  getPickupById,
  deliverPickup,
} from './pickup.service.js';

export const assign = asyncHandler(async (req, res) => {
  const result = await CommandCoordinator.execute({
    key: req.get('Idempotency-Key'),
    method: req.method,
    route: '/api/pickups/assign',
    params: req.params,
    body: req.body,
    userId: req.user._id,
    context: {
      logger: req.log,
      requestId: req.id,
      userId: req.user?._id,
      role: req.user?.role,
      workflow: 'pickup.assign',
      route: '/api/pickups/assign',
    },
    work: async ({ session, commandId, afterCommit, logger }) => {
      const pickup = await assignPickup(
        req.body,
        req.user,
        { session, commandId, afterCommit, logger },
      );
      return {
        status: 201,
        body: new ApiResponse(201, { pickup }, 'Pickup assigned'),
      };
    },
  });

  res.set('X-Command-ID', result.commandId);
  if (result.replayed) res.set('Idempotency-Replayed', 'true');
  res.status(result.status).json(result.body);
});

export const accept = asyncHandler(async (req, res) => {
  const pickup = await acceptPickup(req.params.pickupId, req.user);
  res.status(200).json(new ApiResponse(200, { pickup }, 'Pickup accepted'));
});

export const collect = asyncHandler(async (req, res) => {
  const pickup = await collectPickup(req.params.pickupId, req.body, req.user);
  res.status(200).json(new ApiResponse(200, { pickup }, 'Item collected'));
});

export const deliver = asyncHandler(async (req, res) => {
  const pickup = await deliverPickup(req.params.pickupId, req.body, req.user);
  res.status(200).json(new ApiResponse(200, { pickup }, 'Item delivered to facility'));
});

export const fail = asyncHandler(async (req, res) => {
  const pickup = await failPickup(req.params.pickupId, req.body, req.user);
  res.status(200).json(new ApiResponse(200, { pickup }, 'Pickup marked as failed'));
});

export const getMine = asyncHandler(async (req, res) => {
  const result = await getMyPickups(req.user, req.query);
  res.status(200).json(new ApiResponse(200, result, 'Assigned pickups retrieved'));
});

export const getById = asyncHandler(async (req, res) => {
  const data = await getPickupById(req.params.pickupId, req.user);
  res.status(200).json(new ApiResponse(200, data, 'Pickup details retrieved'));
});
