import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { approveRefund, getRefundEntries, recordRefund } from './refund.service.js';

export const approve = asyncHandler(async (req, res) => {
  const recoveryCase = await approveRefund(req.params.caseId, req.body, req.user);
  res.status(200).json(new ApiResponse(200, { case: recoveryCase }, 'Refund approved'));
});

export const record = asyncHandler(async (req, res) => {
  const result = await recordRefund(req.params.caseId, req.body, req.user);
  res.status(201).json(new ApiResponse(201, result, 'Refund obligation recorded'));
});

export const getByCase = asyncHandler(async (req, res) => {
  const ledgerEntries = await getRefundEntries(req.params.caseId);
  res.status(200).json(new ApiResponse(200, { ledgerEntries }, 'Refund ledger entries retrieved'));
});
