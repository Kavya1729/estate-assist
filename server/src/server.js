import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createApp } from './app.js';

try {
  await connectDatabase(env.MONGODB_URI);
} catch (err) {
  console.error(`Could not connect to MongoDB: ${err.message}`);
  process.exit(1);
}

const app = createApp({ clientOrigin: env.CLIENT_ORIGIN });

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

server.on('error', async (err) => {
  console.error(
    err.code === 'EADDRINUSE'
      ? `Port ${env.PORT} is already in use. Stop the other process or set PORT.`
      : `Server error: ${err.message}`,
  );
  await disconnectDatabase();
  process.exit(1);
});

function shutdown(signal) {
  console.log(`${signal} received, closing server`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
