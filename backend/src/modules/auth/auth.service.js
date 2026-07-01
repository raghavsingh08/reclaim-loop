import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { USER_ROLES } from '../../constants/roles.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';

const SALT_ROUNDS = 12;
const normalizeEmail = (email) => email.trim().toLowerCase();
const createToken = (user) =>
  jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
  });

export const registerUser = async ({ name, email, password, organizationId, phone }) => {
  if (!name?.trim() || !email?.trim() || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
  }
  const normalizedEmail = normalizeEmail(email);
  if (await User.exists({ email: normalizedEmail })) {
    throw new ApiError(409, 'A user with this email already exists');
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    role: USER_ROLES.CUSTOMER,
    organizationId: organizationId || null,
    phone: phone?.trim() || null,
  });
  return { user, token: createToken(user) };
};

export const loginUser = async ({ email, password }) => {
  if (!email?.trim() || !password) throw new ApiError(400, 'Email and password are required');
  const user = await User.findOne({ email: normalizeEmail(email) }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'This account is inactive');

  user.passwordHash = undefined;
  return { user, token: createToken(user) };
};
