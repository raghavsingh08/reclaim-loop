import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { USER_ROLES } from '../constants/roles.js';
import { EventPublisher } from '../domain/eventPublisher.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { User } from '../models/User.js';

const getHandshakeToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const authorization = socket.handshake.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
};

const canAccessCase = async (caseId, user) => {
  if (!mongoose.isValidObjectId(caseId)) return false;
  const filter = { _id: caseId };
  if (user.role === USER_ROLES.CUSTOMER) filter.customerId = user._id;
  return Boolean(await RecoveryCase.exists(filter));
};

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.use(async (socket, next) => {
    try {
      const token = getHandshakeToken(socket);
      if (!token) return next(new Error('Authentication token is required'));

      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub);
      if (!user || !user.isActive) return next(new Error('User is unavailable or inactive'));

      socket.user = user;
      return next();
    } catch {
      return next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    socket.join(`user:${userId}`);
    if (socket.user.role === USER_ROLES.ADMIN) socket.join('admin');
    if (socket.user.role === USER_ROLES.CUSTOMER) socket.join(`customer:${userId}`);
    if (socket.user.role === USER_ROLES.COURIER) socket.join(`courier:${userId}`);
    if (socket.user.role === USER_ROLES.INSPECTOR) socket.join(`inspector:${userId}`);

    socket.on('join-case', async (input, acknowledge) => {
      try {
        const caseId = typeof input === 'string' ? input : input?.caseId;
        const allowed = await canAccessCase(caseId, socket.user);
        if (allowed) socket.join(`case:${caseId}`);
        if (typeof acknowledge === 'function') {
          acknowledge(allowed ? { success: true, caseId } : { success: false, message: 'Case access denied' });
        }
      } catch {
        if (typeof acknowledge === 'function') {
          acknowledge({ success: false, message: 'Unable to join case room' });
        }
      }
    });

    socket.on('leave-case', (input, acknowledge) => {
      const caseId = typeof input === 'string' ? input : input?.caseId;
      if (mongoose.isValidObjectId(caseId)) socket.leave(`case:${caseId}`);
      if (typeof acknowledge === 'function') acknowledge({ success: true, caseId });
    });
  });

  EventPublisher.configure(io);
  return io;
};
