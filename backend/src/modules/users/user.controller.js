import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listUsers } from './user.service.js';

export const getUsers = asyncHandler(async (req, res) => {
  const users = await listUsers({ role: req.query.role });
  res.status(200).json(new ApiResponse(200, { users }, 'Users retrieved'));
});
