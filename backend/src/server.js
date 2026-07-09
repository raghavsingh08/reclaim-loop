import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initializeSocket } from './sockets/socket.js';
import { OutboxWorker } from './workers/outbox.worker.js';

const startServer = async () => {
  try {
    await connectDatabase();
    const server = createServer(app);
    initializeSocket(server);
    server.listen(env.port, () => {
      logger.info({ port: env.port }, 'ReclaimLoop API listening');
      OutboxWorker.start();
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal }, 'Shutdown requested');
      const serverClosed = new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await OutboxWorker.stop();
      await serverClosed;
      await mongoose.connection.close();
      process.exit(0);
    };
    const handleShutdown = (signal) => {
      shutdown(signal).catch((error) => {
        logger.error({ err: error }, 'Graceful shutdown failed');
        process.exit(1);
      });
    };
    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
