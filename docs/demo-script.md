# Interview demo script (about 7 minutes)

Before the call: open https://estate-assist-api.onrender.com/api/health once to wake the API, and
keep two windows ready: the buyer site in a phone-sized window, the staff console in a normal one.
Use a fresh mobile number for the buyer (any 10 digits starting with 6 to 9).

## 1. The problem in one line (20 seconds)

"The developer pays ₹1,000 a lead and a third go cold because the first call comes next morning.
This answers every enquiry in seconds, in the buyer's language, books a real site visit and hands
serious buyers to a named salesperson."

## 2. Buyer on the phone (2 minutes)

1. Landing page: point at the RERA number and the consent checkbox ("DPDP: we only contact with
   consent"). Start a chat for Project 1.
2. Ask: `What is the price of a 3 BHK and when is possession?`
   The answer comes from the fact sheet, with "taxes extra". Say: "It can only state facts from the
   sales head's fact sheet; every number in a reply is checked against what it was given."
3. Ask: `I want a 3 BHK, budget about 1.1 crore, buying in 2 months. Can I visit this Saturday?`
   It saves the profile and offers only real free slots for that Saturday.
4. Reply: `Book the 11 am slot`. Show the confirmation in chat, then the visit page (map link,
   add to calendar, cancel).
5. Ask: `Any discount if I book this week?`
   Say: "Discounts never reach the model. A rule in four languages hands off at once." The buyer
   is told the executive's name.

## 3. Sales console (2.5 minutes)

1. Log in as `meera.desai@example.com` / `Demo@12345`. The new lead is on top: hot, visit booked,
   "Needs reply", owner assigned by workload.
2. Open it: AI summary (needs, budget, open questions), score reasons, the full chat with each tool
   call and its result, the outbox showing the confirmation and the reminders that will follow.
3. Type a staff reply. Mention takeover and hand-back to the AI.
4. Dashboard: median first reply, share within 2 minutes, show-up rate, cost per visit by source.
   "Social ads are the cheapest per visit; hoarding calls are slow because people answer them."
5. Duplicates: open a pair side by side. "Same phone merges automatically; a similar name or a
   shared email is only flagged, a person decides."
6. Review queue: a flagged chat with the blocked reply. "This is the sales head's daily review."

## 4. The hard part: no double booking (1 minute)

Show `server/src/services/visitService.js` (`claimSeat`) and the test
`lets exactly two of twenty simultaneous buyers into a two-seat slot` in
`server/test/integration/visits.test.js`. Explain: one conditional update on `bookedCount <
capacity`, a unique index for one active visit per buyer, and a transaction for seat, visit, lead
and message. The AI cannot book anything the database would refuse.

## 5. Limits, honestly (30 seconds)

- WhatsApp, OTP and portal connectors are simulated; the agent is channel-agnostic.
- Free tiers: the API sleeps when idle, and the model allows two or three messages a minute; beyond
  that the buyer goes to a person instead of waiting.
- The number check is strict on purpose: it can block a harmless number, which then shows up in
  the review queue.

## Likely questions

- **Why not let the model decide discounts or scoring?** Those must be predictable and auditable;
  rules give a reason for every decision.
- **What if the model is down?** A fallback model, then a handoff with a rule-based summary; the
  buyer always gets a reply.
- **Why MongoDB?** Chats and fact sheets are documents, and Atlas gives transactions for booking.
- **What would you build next?** WhatsApp Business with templates and OTP, an evaluation set for
  the assistant, alerts for executives on handoff, and the 48-hour unreached metric.
