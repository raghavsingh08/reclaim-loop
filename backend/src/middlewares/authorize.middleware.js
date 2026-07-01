import { ApiError } from '../utils/ApiError.js';

export const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication is required'));
  if (!allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, 'You are not authorized to access this resource'));
  }
  return next();
};
