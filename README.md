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

Setup and deployment steps live in `docs/deployment.md`.
