import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createCase,
  deleteCaseForTesting,
  getCaseById,
  getCaseCustody,
  getCaseTimeline,
  listCases,
} from './case.service.js';

export const createRecoveryCase = asyncHandler(async (req, res) => {
  const recoveryCase = await createCase(req.body, req.user);
  res.status(201).json(new ApiResponse(201, { case: recoveryCase }, 'Recovery case created'));
});

export const getRecoveryCases = asyncHandler(async (req, res) => {
  const result = await listCases(req.user, req.query);
  res.status(200).json(new ApiResponse(200, result, 'Recovery cases retrieved'));
});

export const getRecoveryCase = asyncHandler(async (req, res) => {
  const recoveryCase = await getCaseById(req.params.caseId, req.user);
  res.status(200).json(new ApiResponse(200, { case: recoveryCase }, 'Recovery case retrieved'));
});

export const getRecoveryCaseTimeline = asyncHandler(async (req, res) => {
  const result = await getCaseTimeline(req.params.caseId, req.user, req.query);
  res.status(200).json(new ApiResponse(200, result, 'Case timeline retrieved'));
});

export const getRecoveryCaseCustody = asyncHandler(async (req, res) => {
  const custodyRecords = await getCaseCustody(req.params.caseId, req.user);
  res.status(200).json(new ApiResponse(200, { custodyRecords }, 'Case custody history retrieved'));
});

export const deleteRecoveryCase = asyncHandler(async (req, res) => {
  const result = await deleteCaseForTesting(req.params.caseId);
  res.status(200).json(new ApiResponse(200, result, 'Recovery case and related test data deleted'));
});
