import { createApp } from './app.js';

const port = Number(process.env.PORT) || 4000;
const app = createApp({ clientOrigin: process.env.CLIENT_ORIGIN });

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
