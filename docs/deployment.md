# Deployment

Estate Assist: AI lead-response and site-visit booking assistant.

- Repository: https://github.com/Kavya1729/estate-assist
- Live web app: https://estate-assist.vercel.app
- Staff console: https://estate-assist.vercel.app/staff/login
- API health: https://estate-assist-api.onrender.com/api/health

The API runs on Render's free plan and sleeps after 15 minutes without traffic. The first request
after a pause can take up to a minute; the web app sends a wake-up ping as soon as it loads.

## Demo login

Buyers need no account: open the web app, enter any name and a 10-digit Indian mobile number
(for example `98250 12345`), tick consent and start the chat.

Staff accounts (all use the password `Demo@12345`):

| Email                       | Role            | Sees                                                                              |
| --------------------------- | --------------- | --------------------------------------------------------------------------------- |
| `meera.desai@example.com`   | Sales head      | Every lead, source dashboard, review queue, duplicates, fact sheet and slot admin |
| `ravi.mehta@example.com`    | Sales executive | Own leads, with their flagged chats and possible duplicates                       |
| `amit.rana@example.com`     | Sales executive | Same, for own leads                                                               |
| `pooja.trivedi@example.com` | Sales executive | Same, for own leads                                                               |
| `sanjay.parmar@example.com` | Sales executive | Same, for own leads                                                               |

All names, phone numbers, emails and RERA numbers in the demo data are made up.

## Run locally

Requirements: Node.js 20.19+ (22 LTS recommended, see `.nvmrc`), npm 10+, and MongoDB running as a
replica set. Bookings use MongoDB transactions, which a standalone `mongod` does not support. The
simplest option is a free Atlas cluster (see below); a local install works as a one-node replica set:

```bash
mongod --replSet rs0 --dbpath <data folder>
mongosh --eval "rs.initiate()"
# then MONGODB_URI=mongodb://127.0.0.1:27017/estate-assist?replicaSet=rs0
```

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
   - `MONGODB_URI`: the Atlas connection string or the local replica-set URI above.
   - With `LLM_PROVIDER=mock` the assistant runs without an API key, answering from the fact sheet
     with keyword matching. Set `LLM_PROVIDER=groq` and `GROQ_API_KEY` for the real model.

3. Load the demo data (wipes the database in `MONGODB_URI` first):

   ```bash
   npm run seed
   ```

   It creates both projects with their fact sheets, five staff accounts, 60 leads (including the
   brief's sample rows LD-58210, LD-58211 and LD-58224) with chats, three weeks of visit slots,
   visits, queued messages and monthly source spend. The same command always produces the same data.
   With `NODE_ENV=production` it refuses to run unless given `--force`.

4. Start the API and the web app together:

   ```bash
   npm run dev
   ```

   - Web app: http://localhost:5173 (staff console at `/staff/login`)
   - API health: http://localhost:4000/api/health (returns `database: "up"` when MongoDB is reachable)

   The web app proxies `/api` to the API in development, so `client/.env.local` is not needed.

5. Run the checks (lint, format, 416 tests and the production build):

   ```bash
   npm run check
   ```

   Tests never touch the configured database. They start a throwaway in-memory MongoDB replica set;
   the first run downloads the MongoDB binary (about 100 MB) and caches it.

### Useful scripts

| Script           | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `npm run dev`    | API and web app with live reload               |
| `npm run seed`   | Replace the database contents with demo data   |
| `npm test`       | API tests against an in-memory MongoDB         |
| `npm run lint`   | ESLint across server and client                |
| `npm run format` | Prettier write                                 |
| `npm run check`  | Lint, format check, tests and production build |

## How it is deployed

| Part     | Host                                 | Configuration in the repository                               |
| -------- | ------------------------------------ | ------------------------------------------------------------- |
| API      | Render (free web service, Singapore) | `render.yaml` (Blueprint, variable names only)                |
| Web app  | Vercel (Vite static build)           | `client/vercel.json` (SPA rewrite, security headers, caching) |
| Database | MongoDB Atlas (free M0)              | none; connection string lives in Render                       |
| AI model | Groq API (`openai/gpt-oss-120b`)     | none; key lives in Render                                     |

Every secret is typed into the Render or Vercel dashboard. The repository only holds variable names
(`render.yaml`, `server/.env.example`, `client/.env.example`).

### 1. Atlas: a database for the live app

1. Create a free M0 cluster at https://cloud.mongodb.com.
2. Database Access: add a user for the live app with a generated password and `readWrite` on the
   database `estate-assist-live`.
3. Network Access: add `0.0.0.0/0`. Render free instances have no fixed outbound IP, so the strong
   password is the protection. Keep your own IP entry for seeding from your machine.
4. Build the connection string with the database name before the `?`:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/estate-assist-live?retryWrites=true&w=majority`

A separate database keeps local development from changing the live demo data.

### 2. Render: the API

1. New, Blueprint, pick this GitHub repository. Render reads `render.yaml` and creates
   `estate-assist-api` (Node 22, build `npm ci --omit=dev`, start `npm start --workspace server`,
   health check `/api/health`).
2. Enter the `sync: false` values: `MONGODB_URI`, `GROQ_API_KEY` and `CLIENT_ORIGIN` (a placeholder
   such as `https://example.com` until the Vercel URL exists).
3. `JWT_SECRET` and `INGEST_API_KEY` are generated by Render. If you replace `JWT_SECRET`, use at
   least 32 characters or the API refuses to start.
4. After the deploy, `/api/health` returns `{"status":"ok","database":"up"}`. A failed start names
   the missing or invalid variable in the log.

### 3. Vercel: the web app

1. Add New, Project, import this GitHub repository.
2. Root Directory: `client`. The framework is detected as Vite.
3. Environment variable `VITE_API_URL` = the Render URL, e.g. `https://estate-assist-api.onrender.com`
   (no trailing slash). Vite bakes it in at build time, so redeploy after changing it.
4. Deploy and note the production URL.

### 4. Connect the two

In Render, Environment, set `CLIENT_ORIGIN` to the exact Vercel production URL (no trailing slash;
separate several with commas). Any other website gets `403` from the API.

### 5. Load the demo data

Render's free plan has no shell, so seed from your machine against the live database, from `server/`:

```bash
MONGODB_URI="<live connection string>" npm run seed
```

The connection string stays in that one command; the local `.env` and the repository are untouched.

### 6. Smoke test on the live app

On a laptop and on a phone:

1. Chat as a buyer: ask the price and possession of a project, ask for slots on a named day, book
   one by replying with the time, then ask for a call back to trigger the handoff.
2. Log in as `meera.desai@example.com`: the new lead is at the top with its visit, score, handoff
   reason, AI summary and assigned executive. Open it and reply as staff.
3. Dashboard: response time, visits, show-up rate and cost per visit by source.
4. Log in as `ravi.mehta@example.com` and confirm only his own leads are visible and the dashboard
   and project admin are not offered.

## Environment variables (names only)

Server (`server/.env` locally, Render dashboard in production):

| Name                  | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`            | `development` or `production`                                           |
| `PORT`                | API port (Render sets it)                                               |
| `MONGODB_URI`         | MongoDB connection string (must be a replica set)                       |
| `JWT_SECRET`          | Signs staff and buyer tokens, at least 32 characters                    |
| `JWT_EXPIRES_IN`      | Staff session length, e.g. `12h`                                        |
| `CLIENT_ORIGIN`       | Comma-separated CORS allowlist, e.g. the Vercel URL                     |
| `LLM_PROVIDER`        | `groq` or `mock`                                                        |
| `GROQ_API_KEY`        | Groq key, required when `LLM_PROVIDER=groq`                             |
| `GROQ_MODEL`          | Default `openai/gpt-oss-120b`                                           |
| `GROQ_FALLBACK_MODEL` | Used when the main model is rate limited, default `openai/gpt-oss-20b`  |
| `INGEST_API_KEY`      | Lets portals and ad forms post leads to `/api/leads/ingest/:source`     |
| `JOBS_ENABLED`        | Runs reminders and message dispatch in the API process (`true`/`false`) |
| `SEED_PASSWORD`       | Optional staff password for `npm run seed` (default `Demo@12345`)       |

Client (`client/.env.local`, Vercel dashboard in production): `VITE_API_URL`, only when the API is on
another origin.

## Free-tier behaviour

- Groq's free plan allows about 8,000 tokens a minute per model, roughly two or three buyer
  messages. When the main model is rate limited the API moves to `GROQ_FALLBACK_MODEL`; if both are
  busy the buyer is handed to a sales executive with a rule-based summary. Groq's paid tier removes
  the limit for real traffic.
- Visit reminders run inside the API process every minute. They are idempotent, so running more than
  one instance is safe. While a free Render instance sleeps, reminders that come due are sent when it
  wakes, and a reminder is never sent after the visit has started. A free uptime monitor calling
  `/api/health` every 10 minutes keeps the API awake.
- Atlas M0 has 512 MB of storage, far more than the demo data needs.
