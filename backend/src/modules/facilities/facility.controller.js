import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createFacility,
  getFacilityById,
  listFacilities,
  receiveCaseAtFacility,
  updateFacilityCapacity,
} from './facility.service.js';

export const create = asyncHandler(async (req, res) => {
  const facility = await createFacility(req.body);
  res.status(201).json(new ApiResponse(201, { facility }, 'Facility created'));
});

export const list = asyncHandler(async (_req, res) => {
  const facilities = await listFacilities();
  res.status(200).json(new ApiResponse(200, { facilities }, 'Facilities retrieved'));
});

export const getOne = asyncHandler(async (req, res) => {
  const facility = await getFacilityById(req.params.facilityId);
  res.status(200).json(new ApiResponse(200, { facility }, 'Facility retrieved'));
});

export const updateCapacity = asyncHandler(async (req, res) => {
  const facility = await updateFacilityCapacity(req.params.facilityId, req.body);
  res.status(200).json(new ApiResponse(200, { facility }, 'Facility capacity updated'));
});

export const receive = asyncHandler(async (req, res) => {
  const recoveryCase = await receiveCaseAtFacility(
    req.params.facilityId,
    req.params.caseId,
    req.body,
    req.user,
  );
  res.status(200).json(new ApiResponse(200, { case: recoveryCase }, 'Item received at facility'));
});
