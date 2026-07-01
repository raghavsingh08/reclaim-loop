import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createCase,
  getCaseById,
  getCaseCustody,
  getCaseTimeline,
  listCases,
  updateCaseStatus,
} from './case.service.js';

export const createRecoveryCase = asyncHandler(async (req, res) => {
  const recoveryCase = await createCase(req.body, req.user);
  res.status(201).json(new ApiResponse(201, { case: recoveryCase }, 'Recovery case created'));
});

export const getRecoveryCases = asyncHandler(async (req, res) => {
  const cases = await listCases(req.user);
  res.status(200).json(new ApiResponse(200, { cases }, 'Recovery cases retrieved'));
});

export const getRecoveryCase = asyncHandler(async (req, res) => {
  const recoveryCase = await getCaseById(req.params.caseId, req.user);
  res.status(200).json(new ApiResponse(200, { case: recoveryCase }, 'Recovery case retrieved'));
});

export const changeRecoveryCaseStatus = asyncHandler(async (req, res) => {
  const recoveryCase = await updateCaseStatus(req.params.caseId, req.body, req.user);
  res.status(200).json(new ApiResponse(200, { case: recoveryCase }, 'Case status updated'));
});

export const getRecoveryCaseTimeline = asyncHandler(async (req, res) => {
  const events = await getCaseTimeline(req.params.caseId, req.user);
  res.status(200).json(new ApiResponse(200, { events }, 'Case timeline retrieved'));
});

export const getRecoveryCaseCustody = asyncHandler(async (req, res) => {
  const custodyRecords = await getCaseCustody(req.params.caseId, req.user);
  res.status(200).json(new ApiResponse(200, { custodyRecords }, 'Case custody history retrieved'));
});
