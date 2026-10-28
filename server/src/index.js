import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { engineStatus } from './services/aiTriage.js';

async function start() {
  try {
    await connectDatabase();
    console.log(`[db] connected to ${env.mongodbUri}`);
  } catch (err) {
    console.error('[db] failed to connect:', err.message);
    console.error('[db] the API needs MongoDB. Start mongod or set MONGODB_URI, then retry.');
    process.exitCode = 1;
    return;
  }

  const app = createApp();
  const engine = engineStatus();
  console.log(`[ai] engine=${engine.engine} configured=${engine.configured}`);

  app.listen(env.port, () => {
    console.log(`[api] GrievanceAI listening on http://localhost:${env.port}`);
    console.log(`[api] health check: http://localhost:${env.port}/api/health`);
  });
}

start();
