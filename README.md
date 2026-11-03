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
    config/       environment and database connection
    constants/    domain values shared across layers (roles, sources, statuses)
    jobs/         scheduled background work (visit reminders, message dispatch)
    lib/          small pure helpers (phone, names, IST time, HttpError)
    middleware/   auth, role guard, validation, rate limiting, error handling
    models/       Mongoose schemas and indexes
    routes/       HTTP endpoints, thin: validate, call a service, respond
    services/     business logic
    validators/   zod request schemas
    app.js        Express app factory (used by tests)
    server.js     process entry: connect, listen, shut down
  test/
    unit/         pure functions
    integration/  HTTP and database behaviour against in-memory MongoDB
    helpers/      test database and factories
```

Setup and deployment steps live in `docs/deployment.md`.
