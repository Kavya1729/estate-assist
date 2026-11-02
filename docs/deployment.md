# Deployment

## Run locally

Requirements: Node.js 20.19+ (22 LTS recommended) and npm 10+.

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create the server environment file and fill in the values:

   ```bash
   cp server/.env.example server/.env
   ```

   `JWT_SECRET` must be at least 32 characters. With `LLM_PROVIDER=mock` the assistant runs without an API key.

3. Start the API and the web app together:

   ```bash
   npm run dev
   ```

   - Web app: http://localhost:5173
   - API: http://localhost:4000/api/health

   The web app proxies `/api` to the API in development.

## Useful scripts

| Script           | What it does                            |
| ---------------- | --------------------------------------- |
| `npm run dev`    | API and web app with live reload        |
| `npm run lint`   | ESLint across server and client         |
| `npm run format` | Prettier write                          |
| `npm run check`  | Lint, format check and production build |

## Environment variables (names only)

Server (`server/.env`): `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `LLM_PROVIDER`, `GROQ_API_KEY`, `GROQ_MODEL`.
