import { USER_ROLE_VALUES } from '../../constants/roles.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';

const USER_LIST_FIELDS =
  '_id name email role phone organizationId isActive createdAt';

export const listUsers = async ({ role } = {}) => {
  const filter = { isActive: true };

  if (role !== undefined) {
    if (typeof role !== 'string') {
      throw new ApiError(400, 'Role must be a single string value');
    }
    const normalizedRole = role.trim().toUpperCase();
    if (!USER_ROLE_VALUES.includes(normalizedRole)) {
      throw new ApiError(400, `Role must be one of: ${USER_ROLE_VALUES.join(', ')}`);
    }
    filter.role = normalizedRole;
  }

  return User.find(filter)
    .select(USER_LIST_FIELDS)
    .sort({ createdAt: -1 })
    .lean();
};
