# Estate Assist

AI lead-response and site-visit booking assistant for a residential developer (2 live projects, 420 apartments).

Every enquiry gets an answer within two minutes, in English, Hindi or Gujarati. The assistant answers only from the sales head's fact sheet, learns what the buyer wants, books a site visit in a real free slot, and hands serious buyers to a named sales executive with the chat history.

## Core build

- Lead list from all sources with duplicate check
- AI chat that answers from the fact sheet
- Site-visit booking against real free slots (no double booking) with reminders
- Handoff to a named sales executive with a chat summary
- Source dashboard: response time, visits, show-up rate, cost per visit

## Structure

```
estate-assist/
  server/   Express + MongoDB API, AI agent, reminders
  client/   React + Vite buyer chat and staff console
  docs/     Technical design document and deployment notes
```

Inside `server/`, a request flows route, then middleware, then service, then model:

```
server/
  src/
    ai/           assistant: LLM providers (Groq, mock), tools, prompt, agent loop,
                  guardrails (language, pre-checks, number post-check), handoff summary
    config/       environment and database connection
    constants/    domain values shared across layers (roles, sources, statuses)
    jobs/         scheduled background work (visit reminders, message dispatch)
    lib/          small pure helpers (phone, names, IST time, HttpError)
    middleware/   auth, role guard, validation, rate limiting, error handling
    models/       Mongoose schemas and indexes
    routes/       HTTP endpoints, thin: validate, call a service, respond
    seed/         `npm run seed`: demo projects, staff, leads, chats, slots, visits, spend
    services/     business logic
    validators/   zod request schemas
    app.js        Express app factory (used by tests)
    server.js     process entry: connect, listen, shut down
  test/
    unit/         pure functions
    integration/  HTTP and database behaviour against in-memory MongoDB
    helpers/      test database and factories
```

## Demo data

`npm run seed` loads Project 1 and Project 2 with their fact sheets, a sales head and four sales
executives, and 60 leads, including the brief's sample rows (Hardik Patel `LD-58210`, Nidhi Shah
`LD-58211`, Kavita Joshi `LD-58224`). All names, numbers and RERA registrations are made up.

| Login                       | Role            |
| --------------------------- | --------------- |
| `meera.desai@example.com`   | Sales head      |
| `ravi.mehta@example.com`    | Sales executive |
| `amit.rana@example.com`     | Sales executive |
| `pooja.trivedi@example.com` | Sales executive |
| `sanjay.parmar@example.com` | Sales executive |

Every account uses the password in `SEED_PASSWORD` (default `Demo@12345`).

Setup and deployment steps live in `docs/deployment.md`.
