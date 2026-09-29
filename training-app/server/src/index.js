import { createApp } from './app.js';
import { config } from './config.js';
import { closeDatabase, connectDatabase } from './db/pool.js';
import { logger } from './logger.js';
import { ensureDefaultRooms } from './modules/event/event.repository.js';
import { ensureAssessmentSchema } from './modules/assessment/assessment.repository.js';

await connectDatabase();
await ensureDefaultRooms();
await ensureAssessmentSchema();

const server = createApp().listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Training API listening');
});

const shutdown = (signal) => {
  logger.info({ signal }, 'Shutdown requested');
  server.close(() => {
    void closeDatabase().finally(() => process.exit(0));
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
