# Deployment

## Run locally

Requirements: Node.js 20.19+ (22 LTS recommended), npm 10+, and MongoDB (local install or an Atlas cluster).

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create the server environment file and fill in the values:

   ```bash
   cp server/.env.example server/.env
   ```

   - `JWT_SECRET` must be at least 32 characters. Generate one with
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   - Leave `MONGODB_URI` empty to use a local MongoDB at `mongodb://127.0.0.1:27017/estate-assist`.
   - With `LLM_PROVIDER=mock` the assistant runs without an API key.

3. Start the API and the web app together:

   ```bash
   npm run dev
   ```

   - Web app: http://localhost:5173
   - API health: http://localhost:4000/api/health (returns `database: "up"` when MongoDB is reachable)

   The web app proxies `/api` to the API in development, so `client/.env.local` is not needed locally.

## External services

### MongoDB Atlas

1. Create a free M0 cluster at https://cloud.mongodb.com.
2. Database Access: add a database user with a generated password.
3. Network Access: allow the API host. For local testing add your current IP.
4. Connect, Drivers: copy the `mongodb+srv://` connection string, insert the password and add the
   database name `estate-assist` before the `?`.
5. Put it in `MONGODB_URI`. Atlas clusters are replica sets, which the booking transactions need.

### Groq

1. Create an API key at https://console.groq.com/keys.
2. Set `LLM_PROVIDER=groq` and `GROQ_API_KEY`. `GROQ_MODEL` defaults to `llama-3.3-70b-versatile`.

## Useful scripts

| Script           | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `npm run dev`    | API and web app with live reload               |
| `npm test`       | API tests against an in-memory MongoDB         |
| `npm run lint`   | ESLint across server and client                |
| `npm run format` | Prettier write                                 |
| `npm run check`  | Lint, format check, tests and production build |

Tests never touch the configured database. They start a throwaway in-memory MongoDB replica set; the
first run downloads the MongoDB binary (about 100 MB) and caches it.

## Environment variables (names only)

Server (`server/.env`): `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`, `LLM_PROVIDER`, `GROQ_API_KEY`, `GROQ_MODEL`, `INGEST_API_KEY`.

Client (`client/.env.local`, only when the API is on another origin): `VITE_API_URL`.
