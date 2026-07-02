import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getCaseDecisions,
  makeDecision,
  startDecisionReview,
} from './decision.service.js';

export const startReview = asyncHandler(async (req, res) => {
  const recoveryCase = await startDecisionReview(req.params.caseId, req.user);
  res.status(200).json(new ApiResponse(200, { case: recoveryCase }, 'Decision review started'));
});

export const decide = asyncHandler(async (req, res) => {
  const result = await makeDecision(req.params.caseId, req.body, req.user);
  res.status(201).json(new ApiResponse(201, result, 'Decision recorded'));
});

export const getByCase = asyncHandler(async (req, res) => {
  const decisions = await getCaseDecisions(req.params.caseId);
  res.status(200).json(new ApiResponse(200, { decisions }, 'Decisions retrieved'));
});
