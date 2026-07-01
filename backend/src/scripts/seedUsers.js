import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { USER_ROLES } from '../constants/roles.js';
import { User } from '../models/User.js';

const SALT_ROUNDS = 12;
const PASSWORD = 'Password123';

const seedUsers = [
  { name: 'Customer', email: 'customer@reclaimloop.test', role: USER_ROLES.CUSTOMER },
  { name: 'Admin', email: 'admin@reclaimloop.test', role: USER_ROLES.ADMIN },
  { name: 'Courier', email: 'courier@reclaimloop.test', role: USER_ROLES.COURIER },
  { name: 'Inspector', email: 'inspector@reclaimloop.test', role: USER_ROLES.INSPECTOR },
];

const run = async () => {
  if (env.nodeEnv !== 'development') {
    throw new Error('User seeding is allowed only when NODE_ENV=development');
  }

  await connectDatabase();

  const usersWithHashes = await Promise.all(
    seedUsers.map(async (user) => ({
      ...user,
      passwordHash: await bcrypt.hash(PASSWORD, SALT_ROUNDS),
    })),
  );

  await User.bulkWrite(
    usersWithHashes.map(({ email, ...fields }) => ({
      updateOne: {
        filter: { email },
        update: {
          $set: { ...fields, email, isActive: true },
        },
        upsert: true,
      },
    })),
  );

  const seededUsers = await User.find({
    email: { $in: seedUsers.map(({ email }) => email) },
  })
    .select('name email role')
    .sort({ role: 1 })
    .lean();

  console.log('Seeded users:');
  console.table(
    seededUsers.map(({ name, email, role }) => ({ name, email, role })),
  );
};

try {
  await run();
} catch (error) {
  console.error('Failed to seed users:', error.message);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}
