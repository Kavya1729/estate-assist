# Estate Assist: Technical Design Document

AI lead-response and site-visit booking assistant for a residential developer in Ahmedabad
(Problem 3).

|                  |                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------- |
| GitHub           | https://github.com/Kavya1729/estate-assist                                              |
| Live app (buyer) | https://estate-assist.vercel.app                                                        |
| Live app (staff) | https://estate-assist.vercel.app/staff/login (`meera.desai@example.com` / `Demo@12345`) |
| API health       | https://estate-assist-api.onrender.com/api/health                                       |
| Setup and deploy | `docs/deployment.md` in the repository (also in this ZIP)                               |

Assumptions are labelled **A1, A2, ...** where they are made and listed together in section 7.

## 1. The problem and what was built

The developer pays about ₹1,000 per lead and lets a third of them go cold because the first call
happens the next morning. The ask: answer every enquiry within two minutes, at any hour, in the
buyer's language; answer basic questions from approved facts; learn what the buyer wants; book a
site visit in a real free slot; and pass serious buyers to a named salesperson with the chat history.

The core build slice works end to end on the live app:

| Core build item                   | What exists                                                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead list with duplicate check    | One list from four sources with source tags, filters, phone-based auto-merge, fuzzy-name and shared-email flags, side-by-side merge screen                           |
| AI chat from the fact sheet       | Agent with five tools in English, Hindi and Gujarati; answers only from the sales head's fact sheet; rule-based guardrails before and after the model                |
| Site-visit booking with reminders | Atomic seat claim in a transaction (no double booking under concurrency), confirmation plus reminders 1 day and 2 hours before, map link, cancel and add-to-calendar |
| Handoff                           | Named executive, reason, AI summary (rule-based fallback), staff takeover and reply in the same chat                                                                 |
| Source dashboard                  | Leads, median first reply, share answered within 2 minutes, visits, show-up rate, spend, cost per lead and per completed visit, by source                            |

Optional depth that also shipped: the sales head's review queue for flagged chats, a full fact sheet
editor, a slot manager, the duplicate-merge screen, consent and opt-out handling, and security
hardening (helmet, CORS allowlist, rate limits).

Roles: **buyer** (no account, a 7-day chat session), **sales executive** (own leads) and **sales
head** (everything, plus dashboard and admin). The brief names buyer and sales executive; the sales
head role was added because the brief gives the fact sheet, slots and flagged-chat review to them.

## 2. Architecture and why

```
 Buyer (phone browser)            Sales team (laptop / phone)
          |                                  |
          v                                  v
 +----------------------------------------------------+
 | React 19 + Vite SPA on Vercel                      |
 |   /, /chat, /visit          /staff/* (lazy-loaded) |
 +----------------------------------------------------+
                          |  HTTPS JSON, CORS allowlist
                          v
 +----------------------------------------------------+
 | Express 5 API on Render                            |
 |   routes -> middleware (auth, roles, zod, limits)  |
 |          -> services (business rules)              |
 |          -> Mongoose models                        |
 |   ai/   agent loop, 5 tools, guardrails, summary   |--> Groq (GPT-OSS 120B,
 |   jobs/ reminders + outbox dispatch every minute   |      20B fallback)
 +----------------------------------------------------+--> WhatsApp (simulated
                          |                                 outbox)
                          v
              MongoDB Atlas (replica set)
```

**Why this shape**

- **One modular monolith, two deployables.** Seven days and one developer: a single API with clear
  layers (route, middleware, service, model) is the fastest to build, test and explain. npm workspaces keep `server/` and `client/` in one
  repository with one `npm run check`. The AI code
  lives in its own folder (`server/src/ai`) behind a small provider interface, so the model or vendor
  can change without touching the business logic.
- **MongoDB.** Leads, chats and fact sheets are document-shaped (a conversation is a list of
  messages with tool calls; a fact sheet is a list of labelled facts). Atlas is free, managed and a
  replica set, which gives multi-document transactions for booking.
- **The booking rule is enforced by the database, not by the AI.** A seat is claimed with one
  conditional update (`bookedCount < capacity`), and a partial unique index allows only one active
  visit per buyer. The seat, the visit, the lead status and the confirmation message are written in
  one transaction. Twenty simultaneous buyers for a two-seat slot produce exactly two visits (tested).
- **The model never touches the database.** It can only call five tools whose inputs are validated
  with zod; the same zod schemas generate the tool definitions sent to the model.
- **Rules where correctness matters, AI where language matters.** Consent, opt-out, discount
  requests, "talk to a person", lead scoring, assignment and number checking are deterministic code.
  The model handles conversation, extraction and summaries.
- **Background jobs in the API process.** Reminders and message dispatch run every minute with
  `node-cron`. Every job is idempotent (`dedupeKey` on the outbox), so a second instance or a restart
  never sends twice. A separate worker was not worth it at this scale (A17).
- **Hosting.** Vercel for the static SPA (global CDN, instant deploys), Render for a long-running
  Node process (cron needs one), Atlas for data, Groq for fast, cheap inference. All on free tiers.

**Stack**: Node 22, Express 5, Mongoose 9, zod 4, JWT, helmet, express-rate-limit, node-cron;
React 19, React Router 7, Tailwind 4, shadcn/ui; Vitest, supertest, mongodb-memory-server.

## 3. Data model

| Collection      | Key fields                                                                                                                                                                                                                                                                                                         | Notes                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `users`         | name, email, passwordHash (bcryptjs, never selected), role, projects, isActive                                                                                                                                                                                                                                     | Role is re-read from the DB on every request, so a demotion takes effect at once              |
| `projects`      | code, name, **reraNumber**, location (address, mapUrl), configurations (bhk, carpet area range, price range), facts [key, label, value], possessionDate, isActive                                                                                                                                                  | The fact sheet. The assistant can only state what is here                                     |
| `leads`         | code (LD-xxxxx), name, phone + normalizedPhone (unique), email, primarySource, sources[] (every touch), project, profile (bhk, budgetMin/Max, timeline), language, consent, score, scoreReasons, temperature, status, assignedTo, handoff {reason, at, summary}, firstResponseAt, possibleDuplicates[], mergedInto | Unique partial index on normalizedPhone = one lead per buyer                                  |
| `conversations` | lead, channel (web; whatsapp later), mode (ai / human), messages [role, text, toolCalls, flagged, blockedText], flagged, reviewedAt                                                                                                                                                                                | Tool calls are stored with each assistant message, so staff see exactly what the AI looked up |
| `slots`         | project, startsAt, endsAt, capacity, bookedCount, isBlocked                                                                                                                                                                                                                                                        | Unique on (project, startsAt)                                                                 |
| `visits`        | lead, slot, project, startsAt, status (booked, cancelled, visited, no_show), bookedVia (assistant / staff), reminders {dayBeforeSentAt, twoHoursBeforeSentAt}                                                                                                                                                      | Partial unique index: one `booked` visit per lead                                             |
| `outbox`        | lead, visit, template, to, body, status (queued, sent, skipped_opt_out), dedupeKey (unique)                                                                                                                                                                                                                        | Every outgoing WhatsApp message, including suppressed ones                                    |
| `sourcespends`  | source, month (YYYY-MM), amount                                                                                                                                                                                                                                                                                    | Marketing spend per source per month, for cost per lead and per visit (A4)                    |

Lead statuses: new → engaged → visit_booked → visited / no_show, or lost. Sources: property portal,
social media ad, website form, hoarding call.

## 4. Main flows

**4.1 Lead intake and duplicate check.** Every source goes through one `ingestLead` function: the
website chat start, `POST /api/leads/ingest/:source` for portals and ad forms (API key), and staff
adding a hoarding call.

1. The phone is normalised to a 10-digit Indian mobile (`+91 98250-12345` → `9825012345`).
2. Same phone → the same buyer: the new source is appended to the existing lead and blank profile
   fields are filled in (A2).
3. Same email with no conflicting phone → also merged. Same email with a different phone (a
   shared family email) or a similar name (Levenshtein similarity ≥ 0.85 on a normalised name) →
   kept separate and **flagged** for a person.
4. A new lead is scored and assigned to the active executive with the fewest open leads who
   covers that project (A11).

Flagged pairs appear on the lead and in a side-by-side compare screen, where staff merge (moves
sources, chats and visits; refuses if both have visits or belong to different executives) or ignore.

**4.2 One buyer chat turn** (`conversationService.handleBuyerMessage`, fixed order):

1. Detect the language from the script and remember it.
2. Consent rules: STOP opts out (all messages suppressed), START opts back in. Never the model.
3. If a person has taken over, store the message only; the AI stays silent.
4. Pre-checks: a discount, "best price" or negotiation request, or a request for a person, in
   English, Hinglish, Hindi or Gujarati, hands off at once.
5. Agent turn: the model may call tools up to 5 times, then must reply.
6. Post-check: every number in the reply must exist in what the model was given. Otherwise the
   reply is replaced with a safe message, the original is kept for review and the chat is flagged.

**4.3 Booking.** `get_free_slots` returns only open, unblocked slots at least 60 minutes ahead
with seats left, labelled in the buyer's language. The buyer picks one by replying in chat or by
tapping the inline slot picker; both call the same `bookVisit` service. It claims the seat
atomically, creates the visit, moves the lead to `visit_booked`, rescores it and queues the
confirmation (project, time, address) in one transaction. The 2-hours-before reminder carries the
map link. Rescheduling releases the old
seat only after the new one is secured.

**4.4 Reminders.** Every minute the job queues a day-before reminder (visits 2 to 24 hours away,
booked at least a day ahead, so a same-day booking is not spammed) and a 2-hours-before reminder.
The outbox `dedupeKey` makes each reminder unique; opted-out buyers get a `skipped_opt_out` record
instead of a message. Delivery is simulated (A10).

**4.5 Handoff.** Triggered by the buyer, a pre-check, the model's `handoff_to_human` tool (missing
fact, price question, serious buyer), a failed model call or a runaway turn. The conversation
switches to `human` mode, the lead keeps or gets a named executive, and a summary (needs, budget,
open questions, concerns) is written by a JSON-mode model call validated with zod, falling back to a
rule-based summary. The buyer is told the executive's name. Staff see the lead flagged "Needs reply",
read the full chat with tool calls, reply in the same chat, and can hand the chat back to the AI.

**4.6 Dashboard.** For a date range (7, 30, 90 days, this month): leads by first source and hot
share, median first reply and share answered within 2 minutes (the brief's target), visits booked,
visited and no-show, show-up rate, spend, cost per lead and cost per completed visit by source, plus
queue counts (chats waiting for a person, possible duplicates, replies blocked by guardrails).

## 5. AI design and what happens when it is wrong

**Model.** `openai/gpt-oss-120b` on Groq with tool calling, `reasoning_effort: low`, temperature
0.2. If it is rate limited the call moves straight to `openai/gpt-oss-20b` (separate quota). Groq was
chosen for speed: a full turn with a tool call takes about 3 seconds, well inside the two-minute
target. A deterministic mock provider (keyword search over the same fact sheet) runs the whole
product and the test suite without a key.

**Tools** (all inputs validated by zod; bad input returns an error the model can correct):

| Tool                  | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `get_facts`           | Search the project's fact sheet and core fields; the only source of facts |
| `update_lead_profile` | Save BHK, budget (in rupees), timeline, project, notes; rescores the lead |
| `get_free_slots`      | Real free slots for a project and date range                              |
| `book_visit`          | Book a slot returned by `get_free_slots`; enforces every booking rule     |
| `handoff_to_human`    | Hand to a named executive with a reason and summary                       |

**Prompt.** Rules first, then context: today's date and the next 8 days with weekdays in IST
(models are unreliable at weekday arithmetic, and an early version offered Thursday's slots as
Saturday), the active projects, what is known about the buyer and any upcoming visit. Facts are
never pasted into the prompt; the model must fetch them, which ties every answer to the fact sheet.

**Defences, mapped to the brief's "when it is wrong" rules**

| Risk                                              | Defence                                                                                                       | Type          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------- |
| States a fact that is not on the fact sheet       | Prompt forbids it; post-check blocks any unsupported number (price, size, date) and flags the chat for review | Rule + prompt |
| Fact missing                                      | Model says a person will confirm and calls `handoff_to_human` (reason `missing_fact`)                         | Prompt + tool |
| Quotes a final price or discount                  | Negotiation phrases in 4 languages hand off before the model runs; prompt forbids offers                      | Rule          |
| Buyer wants a person                              | Detected by rules in 4 languages at any time, plus a "Talk to a person" button                                | Rule + UI     |
| Books a slot that is not free                     | `book_visit` only accepts real slot ids and claims the seat atomically; the reply confirms only on success    | Database      |
| Model down, slow, rate limited or returns nothing | Fallback model, then handoff with a rule-based summary; the buyer always gets a reply                         | Code          |
| Loops on tools                                    | Hard cap of 5 tool calls per turn, then handoff                                                               | Code          |
| Wrong language                                    | Script detection sets the language; the prompt mirrors Hinglish                                               | Rule + prompt |
| Formatting leaks (citations, markdown)            | Stripped before the reply is stored                                                                           | Code          |
| Sales head review                                 | Every flagged chat lands in the review queue with the blocked text and reason                                 | UI            |

**Known limits.** The number post-check is strict on purpose: a harmless "within 24 hours" can be
blocked and flagged (A14). On the free Groq tier the assistant handles about two or three messages a
minute; beyond that buyers are handed to a person rather than kept waiting (A17). The model
occasionally answers a two-part question in two turns.

## 6. UI and design decisions

The brief asks for calm, premium and minimal, with buyers mostly on phones.

- **Visual language.** Warm off-white background, deep green primary, a soft sand accent; a serif
  (Fraunces) for headings and Inter for text. Restrained colour is used only for meaning: hot, warm
  and cold badges, errors and the active state.
- **Buyer landing.** One promise ("Find your home. Visit it this week."), the two projects with
  possession, location and RERA number, and a short start form: name, mobile, project and an
  explicit consent checkbox (DPDP). Nothing else competes for attention.
- **Chat.** Full-height, thumb-friendly, with a language switcher (EN, हि, ગુ), a typing
  indicator, "Book a site visit" and "Talk to a person" always one tap away, and an inline slot
  picker (day tabs, time chips, seats left) so booking takes two taps. A RERA footer is on every
  screen, as required for promotional messages.
- **Visit page.** The booked visit with address, map link, add to calendar and cancel.
- **Staff lead list.** Dense but scannable: name, masked phone, temperature and score, status,
  source, project, budget, upcoming visit, owner and "Needs reply". Filters for temperature,
  needs reply, duplicates, source, status, project and owner. Phones are masked in lists (DPDP).
- **Lead detail.** Profile and score reasons, the AI summary card at the top for a fast call, the
  full chat including what each tool returned, staff reply box with takeover and hand-back, visits
  with outcome buttons, and the outbox so staff can see which messages went out or were suppressed.
- **Dashboard.** Four headline cards, then per-source bars and tables, with the 2-minute target
  and cheapest source called out in words, not only colour.
- **Sales head tools.** Review queue, side-by-side duplicate compare with differences highlighted,
  fact sheet editor with per-field validation and an unsaved-changes guard, and a weekly slot manager.
- **States everywhere.** Every data screen has loading skeletons, empty states with a next step,
  and error states with retry; buttons show progress and disable while working. Layouts are checked
  at 320 px and 375 px wide with no horizontal scroll.

## 7. Assumptions

- **A1 Sources.** Four lead sources: property portal, social media ad, website form, hoarding
  call. Portals and ads post to an ingest API; hoarding calls are entered by staff. Real connectors
  are simulated by the seed data.
- **A2 Same buyer.** The same normalised Indian mobile number is always the same buyer and is merged
  automatically. Anything weaker (similar name, shared email with another phone) is only flagged.
- **A3 Attribution.** A lead belongs to its first source; later touches are kept for context.
- **A4 Spend.** Monthly spend per source is entered as data. The brief's ₹30 lakh a month for
  3,000 leads is scaled down to the demo's 60 leads.
- **A5 Slots.** The sales head publishes slots per project (seeded hourly, 10 am to 6 pm, two
  parties each). Bookings close 60 minutes before the start. A buyer holds one upcoming visit.
- **A6 Show-up.** An executive marks visited or no-show after the visit starts. Cost per visit
  uses completed visits.
- **A7 First response.** Measured from when the lead arrives to the first reply by the assistant
  or a person. Hoarding calls are answered by people, so their response time is slower.
- **A8 Language.** Detected from the script: Devanagari is Hindi, Gujarati script is Gujarati, Latin
  is English; Hinglish in Latin script is mirrored by the model.
- **A9 Identity.** The website chat has no OTP. A new session only sees messages from that session,
  so a stranger typing someone's number cannot read their earlier chat. Production would add a
  WhatsApp OTP.
- **A10 Messaging.** WhatsApp is simulated with an outbox and a dispatcher that marks messages sent.
  The four templates (confirmation, 1-day and 2-hour reminders, opt-out confirmation) are assumed to
  be approved opt-in templates.
- **A11 Assignment.** A lead goes to the active executive with the fewest open leads who covers its
  project, at intake. The sales head can reassign.
- **A12 Scoring.** Rule-based, not AI, so every point has a reason: budget fits a configuration
  (30), visit booked (40), buying within 3 months (20), consent (10). Hot at 70 or more, warm at 40.
- **A13 Prices.** The fact sheet holds base price ranges; the assistant may quote those ranges with
  "taxes and charges extra" but never a final price or a discount.
- **A14 Strict post-check.** Blocking a correct reply that contains an unsupported number is
  preferred to letting a wrong price or date through.
- **A15 Demo data.** "Project 1" and "Project 2", their RERA numbers, addresses, prices and all
  people are made up, built around the brief's sample rows (LD-58210, LD-58211, LD-58224).
- **A16 Time zone.** Everything is shown and scheduled in IST.
- **A17 Scale and hosting.** Free tiers are enough for a demo: the API sleeps when idle and the
  model is limited to about 8,000 tokens a minute. Production would use paid tiers (section 8).

## 8. Testing, security and quality

- **416 automated tests** (Vitest): unit tests for phone and name normalisation, scoring, guardrails,
  fact search, prompt and provider behaviour; integration tests against an in-memory MongoDB replica
  set for lead intake and merging, booking (including 20 buyers racing for 2 seats, cancel and book
  races, one buyer clicking several slots), reminders, the agent loop with a scripted model, handoff,
  access control, the dashboard and the seed. Mutation testing was used to find weak assertions.
- **Access control.** Staff JWT with the role re-read from the database; executives only reach their
  own leads; buyer tokens are rejected on staff routes and vice versa; login is rate limited.
- **Input and transport.** Every request body, query and param is validated with zod; 100 kB body
  limit; helmet with a strict CSP; CORS allowlist; chat rate limits per IP.
- **Data protection.** No secrets or real personal data in the repository; consent stored with
  time; STOP honoured; phones masked in lists.
- **Process.** 60+ small conventional commits, `npm run check` (lint, format, tests, build) before every
  push.

## 9. What was cut, and what next

**Cut (with reason)**

- Real WhatsApp Business API, email parsing and portal connectors: simulated with an outbox and an
  ingest API, as the brief allows.
- OTP verification for buyers (A9).
- Buyer-initiated rescheduling in chat: the assistant hands changes to the executive; staff can
  reschedule, and buyers can cancel and rebook.
- Executive notifications (push, email) for new handoffs: the "Needs reply" filter and dashboard
  queue show them instead.
- A separate worker process and job queue (A17).
- Staff UI translation: the buyer side is in three languages, the staff side in English.

**Next, in order**

1. WhatsApp Business API with approved templates and OTP, so the same agent serves WhatsApp.
2. Paid model tier and an evaluation set of real buyer questions (fact accuracy, handoff precision,
   language) run before every prompt change.
3. Executive alerts for handoffs with a response-time clock, since the brief's goal is speed.
4. Lead-to-visit funnel and 48-hour unreached rate on the dashboard, the brief's success metrics.
5. Calendar sync for executives and site staff, and a check-in QR to record show-ups at the site.
6. Move jobs to a worker with a queue once traffic grows; add structured logging and alerts.
