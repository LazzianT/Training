import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const server = createApp().listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Training API listening');
});

const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutdown requested');
  server.close(() => process.exit(0));
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
