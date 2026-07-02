import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getAdminDashboard,
  getCourierDashboard,
  getCustomerDashboard,
  getInspectorDashboard,
} from './dashboard.service.js';

export const customerDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getCustomerDashboard(req.user._id);
  res.status(200).json(new ApiResponse(200, dashboard, 'Customer dashboard retrieved'));
});

export const courierDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getCourierDashboard(req.user._id);
  res.status(200).json(new ApiResponse(200, dashboard, 'Courier dashboard retrieved'));
});

export const inspectorDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getInspectorDashboard(req.user._id);
  res.status(200).json(new ApiResponse(200, dashboard, 'Inspector dashboard retrieved'));
});

export const adminDashboard = asyncHandler(async (_req, res) => {
  const dashboard = await getAdminDashboard();
  res.status(200).json(new ApiResponse(200, dashboard, 'Admin dashboard retrieved'));
});
