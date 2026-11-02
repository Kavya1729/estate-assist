import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp({ clientOrigin: env.CLIENT_ORIGIN });

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
