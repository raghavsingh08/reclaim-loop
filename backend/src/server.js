import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { initializeSocket } from './sockets/socket.js';
import { OutboxWorker } from './workers/outbox.worker.js';
import dns from "dns"
dns.setServers(["8.8.8.8", "8.8.4.4"])

const startServer = async () => {
  try {
    await connectDatabase();
    const server = createServer(app);
    initializeSocket(server);
    server.listen(env.port, () => {
      console.log(`ReclaimLoop API listening on port ${env.port}`);
      OutboxWorker.start();
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`${signal} received. Shutting down...`);
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
        console.error('Graceful shutdown failed:', error.message);
        process.exit(1);
      });
    };
    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
