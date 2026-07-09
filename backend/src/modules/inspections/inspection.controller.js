import { CommandCoordinator } from '../../domain/commandCoordinator.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  assignInspection,
  completeInspection,
  getInspectionByCase,
  getMyInspections,
  startInspection,
} from './inspection.service.js';

export const assign = asyncHandler(async (req, res) => {
  const result = await CommandCoordinator.execute({
    key: req.get('Idempotency-Key'),
    method: req.method,
    route: '/api/inspections/:caseId/assign',
    params: req.params,
    body: req.body,
    userId: req.user._id,
    context: {
      logger: req.log,
      requestId: req.id,
      userId: req.user?._id,
      role: req.user?.role,
      workflow: 'inspection.assign',
      route: '/api/inspections/:caseId/assign',
    },
    work: async ({ session, commandId, afterCommit, logger }) => {
      const inspection = await assignInspection(
        req.params.caseId,
        req.body,
        req.user,
        { session, commandId, afterCommit, logger },
      );
      return {
        status: 201,
        body: new ApiResponse(201, { inspection }, 'Inspection assigned'),
      };
    },
  });

  res.set('X-Command-ID', result.commandId);
  if (result.replayed) res.set('Idempotency-Replayed', 'true');
  res.status(result.status).json(result.body);
});

export const start = asyncHandler(async (req, res) => {
  const inspection = await startInspection(req.params.caseId, req.user);
  res.status(201).json(new ApiResponse(201, { inspection }, 'Inspection started'));
});

export const complete = asyncHandler(async (req, res) => {
  const inspection = await completeInspection(req.params.caseId, req.body, req.user);
  res.status(200).json(new ApiResponse(200, { inspection }, 'Inspection completed'));
});

export const getOne = asyncHandler(async (req, res) => {
  const result = await getInspectionByCase(req.params.caseId, req.user);
  res.status(200).json(new ApiResponse(200, result, 'Inspection retrieved'));
});

export const getMine = asyncHandler(async (req, res) => {
  const result = await getMyInspections(req.user, req.query);
  res.status(200).json(new ApiResponse(200, result, 'Assigned inspections retrieved'));
});
