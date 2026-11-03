import mongoose from 'mongoose';

import { DAY, HOUR, MINUTE, addDays, istDateOf, istDateTime } from '../lib/time.js';
import { normalizeIndianMobile } from '../lib/phone.js';
import * as models from '../models/index.js';
import { applyLeadScore } from '../services/leadScoring.js';
import { renderMessage, visitMessageVars } from '../services/messageTemplates.js';
import { DEFAULT_VISIT_TIMES, bookingCutoff } from '../services/slotService.js';
import { CHATS } from './data/chats.js';
import { PROJECTS } from './data/projects.js';
import { STAFF } from './data/staff.js';
import { STORY_LEADS } from './data/storyLeads.js';
import { generateFillerLeads } from './fillerLeads.js';
import { createRandom } from './random.js';

const { Conversation, Counter, Lead, Outbox, Project, Slot, SourceSpend, User, Visit } = models;

export const DEMO_PASSWORD = 'Demo@12345';
/** About 60 leads in the list; the merged-away duplicate is extra. */
const VISIBLE_LEADS = 60;
const LEAD_CODE_START = 58_200;
const SLOT_DAYS_BEFORE = 7;
const SLOT_DAYS_AFTER = 14;
const SLOT_CAPACITY = 2;
/** Rupees per lead by source, matching the brief's ₹1,000 average. */
const COST_PER_LEAD = { portal: 1400, social_ad: 650, website: 250, hoarding_call: 900 };

const newId = () => new mongoose.Types.ObjectId();

/** Validates like a normal save (so pre-validate hooks run) but keeps the dates we set. */
async function insertAt(Model, docs) {
  if (!docs.length) return;
  const built = docs.map((doc) => new Model(doc));
  await Promise.all(built.map((doc) => doc.validate()));
  await Model.collection.insertMany(built.map((doc) => doc.toObject({ transform: false })));
}

function parseIst(value) {
  const [date, time] = value.split('T');
  return istDateTime(date, time);
}

function arrivalOf(spec, now) {
  return typeof spec.arrived === 'string'
    ? parseIst(spec.arrived)
    : new Date(now.getTime() - spec.arrived * DAY);
}

function visitTimeOf(visit, today) {
  return visit.at ? parseIst(visit.at) : istDateTime(addDays(today, visit.inDays), visit.time);
}

/** In-memory slot calendar, so seats are counted before anything is written. */
function createSlotBook(projects, today) {
  const slots = new Map();
  const keyOf = (project, startsAt) => `${project.code}|${startsAt.toISOString()}`;

  const ensure = (project, startsAt) => {
    const key = keyOf(project, startsAt);
    if (!slots.has(key)) {
      slots.set(key, {
        _id: newId(),
        project: project._id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + project.visitDurationMinutes * MINUTE),
        capacity: SLOT_CAPACITY,
        bookedCount: 0,
        isBlocked: false,
      });
    }
    return slots.get(key);
  };

  for (const project of projects) {
    for (let day = -SLOT_DAYS_BEFORE; day < SLOT_DAYS_AFTER; day += 1) {
      for (const time of DEFAULT_VISIT_TIMES)
        ensure(project, istDateTime(addDays(today, day), time));
    }
  }

  return {
    ensure,
    block(project, date, times) {
      for (const time of times) ensure(project, istDateTime(date, time)).isBlocked = true;
    },
    /**
     * The wanted slot, or the nearest free one later that day or on the next
     * days that `accept` allows (past visits must stay in the past).
     */
    reserve(project, startsAt, { holdsSeat = true, accept = () => true } = {}) {
      const candidates = [ensure(project, startsAt)];
      for (let day = 0; day < 5; day += 1) {
        for (const time of DEFAULT_VISIT_TIMES) {
          const at = istDateTime(addDays(istDateOf(startsAt), day), time);
          if (at > startsAt) candidates.push(ensure(project, at));
        }
      }
      const slot = candidates.find(
        (s) => !s.isBlocked && accept(s) && (!holdsSeat || s.bookedCount < s.capacity),
      );
      if (!slot) throw new Error(`No free slot for ${project.code} near ${startsAt.toISOString()}`);
      if (holdsSeat) slot.bookedCount += 1;
      return slot;
    },
    all: () => [...slots.values()],
  };
}

function remindersFor(visit, bookedAt, now) {
  const reminders = {};
  const dayBefore = new Date(visit.startsAt.getTime() - DAY);
  const twoHoursBefore = new Date(visit.startsAt.getTime() - 2 * HOUR);
  if (bookedAt <= dayBefore && dayBefore <= now) reminders.dayBeforeSentAt = dayBefore;
  if (bookedAt <= twoHoursBefore && twoHoursBefore <= now) {
    reminders.twoHoursBeforeSentAt = twoHoursBefore;
  }
  return reminders;
}

/** Null for leads without a phone: like `queueMessage`, nothing goes to them. */
function outboxMessage(lead, template, vars, { at, visit, dedupeKey }) {
  if (!lead.normalizedPhone) return null;
  return {
    lead: lead._id,
    visit: visit?._id,
    template,
    to: `+91${lead.normalizedPhone}`,
    body: renderMessage(template, lead.language, vars),
    status: 'sent',
    sentAt: at,
    dedupeKey,
    createdAt: at,
    updatedAt: at,
  };
}

/** Builds the messages of a chat script on a timeline starting at the lead's arrival. */
function buildChat(script, context, arrivedAt, firstGapSeconds) {
  let at = arrivedAt.getTime();
  return script(context).map((message, index) => {
    at += (index === 0 ? firstGapSeconds : message.gap) * 1000;
    return {
      _id: newId(),
      role: message.role,
      text: message.text,
      author: message.author?._id,
      toolCalls: message.toolCalls,
      flagged: message.flagged ?? false,
      flagReason: message.flagReason,
      blockedText: message.blockedText,
      createdAt: new Date(at),
    };
  });
}

function assignCodes(specs) {
  const reserved = new Set(specs.filter((s) => s.code).map((s) => s.code));
  let next = LEAD_CODE_START;
  for (const spec of [...specs].sort((a, b) => a.arrivedAt - b.arrivedAt)) {
    if (spec.code) continue;
    do next += 1;
    while (reserved.has(`LD-${next}`));
    spec.code = `LD-${next}`;
  }
  return Math.max(...specs.map((s) => Number(s.code.slice(3)))) - LEAD_CODE_START;
}

function spendRows(leads) {
  const totals = new Map();
  const months = new Set();
  for (const lead of leads) {
    const month = istDateOf(lead.firstInboundAt).slice(0, 7);
    months.add(month);
    const key = `${lead.primarySource}|${month}`;
    totals.set(key, (totals.get(key) ?? 0) + COST_PER_LEAD[lead.primarySource]);
  }
  const rows = [];
  for (const month of months) {
    for (const source of Object.keys(COST_PER_LEAD)) {
      // A month's spend is never zero: hoardings and listings are paid for even in a quiet week.
      const amount = totals.get(`${source}|${month}`) ?? COST_PER_LEAD[source];
      rows.push({ source, month, amount: Math.round(amount / 500) * 500 });
    }
  }
  return rows;
}

/**
 * Replaces everything in the database with the demo data set. Deterministic:
 * the same `now` always produces the same records.
 */
export async function seedDatabase({ now = new Date(), password = DEMO_PASSWORD } = {}) {
  const random = createRandom();
  const today = istDateOf(now);

  await Promise.all(Object.values(models).map((model) => model.deleteMany?.({})));

  const projectDocs = PROJECTS.map((p) => ({ _id: newId(), visitDurationMinutes: 45, ...p }));
  const projectByCode = new Map(projectDocs.map((p) => [p.code, p]));
  await insertAt(Project, projectDocs);

  const staffByKey = new Map();
  let passwordHash;
  for (const member of STAFF) {
    const user = new User({
      name: member.name,
      email: member.email,
      role: member.role,
      projects: member.projects.map((code) => projectByCode.get(code)._id),
    });
    // Everyone shares the demo password, so hash it once (bcrypt is slow on purpose).
    if (passwordHash) user.passwordHash = passwordHash;
    else await user.setPassword(password);
    passwordHash = user.passwordHash;
    await user.save();
    staffByKey.set(member.key, user);
  }

  const takenNames = new Set(STORY_LEADS.map((s) => s.name));
  const takenPhones = new Set(STORY_LEADS.map((s) => s.phone).filter(Boolean));
  const visibleStories = STORY_LEADS.filter((s) => !s.mergedInto).length;
  const specs = [
    ...STORY_LEADS.map((s) => ({ ...s })),
    ...generateFillerLeads(random, {
      count: VISIBLE_LEADS - visibleStories,
      projects: projectDocs,
      staff: STAFF,
      takenNames,
      takenPhones,
    }),
  ];
  for (const spec of specs) {
    spec._id = newId();
    spec.arrivedAt = arrivalOf(spec, now);
  }
  const specByKey = new Map(specs.map((s) => [s.key, s]));
  const lastCode = assignCodes(specs);

  const slotBook = createSlotBook(projectDocs, today);
  // Site maintenance one afternoon: shows blocked slots in the schedule.
  slotBook.block(projectByCode.get('P2'), addDays(today, 5), ['15:00', '16:00', '17:00', '18:00']);

  const leads = [];
  const visits = [];
  const conversations = [];
  const outbox = [];

  for (const spec of specs) {
    const project = projectByCode.get(spec.project);
    const owner = spec.owner ? staffByKey.get(spec.owner) : null;
    const hasChat = Boolean(spec.chat && spec.response?.seconds);
    const lead = {
      _id: spec._id,
      code: spec.code,
      name: spec.name,
      phone: spec.phone,
      normalizedPhone: spec.phone ? normalizeIndianMobile(spec.phone) : undefined,
      email: spec.email,
      primarySource: spec.source,
      sources: [
        { source: spec.source, receivedAt: spec.arrivedAt, campaign: spec.campaign },
        ...(spec.extraSources ?? []).map((extra) => ({
          source: extra.source,
          receivedAt: new Date(spec.arrivedAt.getTime() + extra.daysLater * DAY),
        })),
      ],
      project: project._id,
      profile: { timeline: 'unknown', ...spec.profile },
      language: spec.language ?? 'en',
      consent:
        spec.consent === false && !hasChat ? { given: false } : { given: true, at: spec.arrivedAt },
      assignedTo: owner?._id,
      assignedAt: owner ? new Date(spec.arrivedAt.getTime() + MINUTE) : undefined,
      status: spec.status ?? 'engaged',
      firstInboundAt: spec.arrivedAt,
      possibleDuplicates: [],
      createdAt: spec.arrivedAt,
      updatedAt: spec.arrivedAt,
    };
    const touch = (at) => {
      if (at > lead.updatedAt) lead.updatedAt = at;
    };

    if (spec.response?.minutes) {
      lead.firstResponseAt = new Date(spec.arrivedAt.getTime() + spec.response.minutes * MINUTE);
    }

    // Plan the visits first: the chat script needs their ids and times.
    let visit = null;
    if (spec.visit) {
      const bookedVia =
        spec.visit.bookedVia === 'assistant' && !hasChat ? 'staff' : spec.visit.bookedVia;
      const startsAt = visitTimeOf(spec.visit, today);
      const accept = spec.visit.at
        ? undefined
        : spec.visit.outcome
          ? (s) => s.endsAt <= now
          : (s) => s.startsAt >= bookingCutoff(now);
      const slot = slotBook.reserve(project, startsAt, { accept });
      visit = {
        _id: newId(),
        lead: lead._id,
        slot: slot._id,
        project: project._id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: spec.visit.outcome ?? 'booked',
        bookedVia,
        assignedTo: owner?._id,
      };
    }

    let messages = [];
    if (hasChat) {
      const context = { lead: { ...spec, ...lead }, project, owner, visit };
      if (spec.handoff) context.lead.handoff = { summary: spec.handoff };
      messages = buildChat(CHATS[spec.chat], context, spec.arrivedAt, spec.response.seconds);
      lead.firstResponseAt = messages.find((m) => m.role !== 'buyer')?.createdAt;
    } else if (spec.response?.seconds) {
      lead.firstResponseAt = new Date(spec.arrivedAt.getTime() + spec.response.seconds * 1000);
    }

    if (spec.cancelledVisit) {
      const slot = slotBook.reserve(project, visitTimeOf(spec.cancelledVisit, today), {
        holdsSeat: false,
      });
      const bookedAt = new Date(spec.arrivedAt.getTime() + 2 * HOUR);
      const cancelledAt = new Date(slot.startsAt.getTime() - 20 * HOUR);
      const cancelled = {
        _id: newId(),
        lead: lead._id,
        slot: slot._id,
        project: project._id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: 'cancelled',
        bookedVia: 'staff',
        assignedTo: owner?._id,
        cancelledAt,
        createdAt: bookedAt,
        updatedAt: cancelledAt,
      };
      visits.push(cancelled);
      outbox.push(
        outboxMessage(
          lead,
          'visit_confirmation',
          visitMessageVars({ lead, project, visit: cancelled }),
          {
            at: bookedAt,
            visit: cancelled,
            dedupeKey: `visit_confirmation:${cancelled._id}`,
          },
        ),
      );
      touch(cancelledAt);
      if (visit) visit.createdAt = new Date(cancelledAt.getTime() + HOUR);
    }

    if (visit) {
      const bookingMessage = messages.find((m) =>
        m.toolCalls?.some((c) => c.name === 'book_visit'),
      );
      const bookedAt =
        bookingMessage?.createdAt ??
        visit.createdAt ??
        new Date(spec.arrivedAt.getTime() + 2 * HOUR);
      visit.createdAt = bookedAt;
      visit.reminders = remindersFor(visit, bookedAt, now);
      if (visit.status !== 'booked') visit.outcomeAt = new Date(visit.endsAt.getTime() + HOUR);
      visit.updatedAt = visit.outcomeAt ?? bookedAt;
      visits.push(visit);
      lead.status = { booked: 'visit_booked', visited: 'visited', no_show: 'no_show' }[
        visit.status
      ];
      touch(visit.updatedAt);

      const vars = visitMessageVars({ lead, project, visit });
      outbox.push(
        outboxMessage(lead, 'visit_confirmation', vars, {
          at: bookedAt,
          visit,
          dedupeKey: `visit_confirmation:${visit._id}`,
        }),
      );
      const sentReminders = [
        ['reminder_24h', visit.reminders.dayBeforeSentAt],
        ['reminder_2h', visit.reminders.twoHoursBeforeSentAt],
      ];
      for (const [template, at] of sentReminders) {
        if (at) {
          outbox.push(
            outboxMessage(lead, template, vars, {
              at,
              visit,
              dedupeKey: `${template}:${visit._id}`,
            }),
          );
        }
      }
    }

    if (messages.length) {
      const conversationId = newId();
      const lastAt = messages.at(-1).createdAt;
      const takeover = messages.find((m) => m.role === 'system');
      const conversation = {
        _id: conversationId,
        lead: lead._id,
        channel: 'web',
        mode: spec.handoff ? 'human' : 'ai',
        messages,
        flagged: messages.some((m) => m.flagged),
        lastMessageAt: lastAt,
        createdAt: messages[0].createdAt,
        updatedAt: lastAt,
      };
      if (takeover) {
        conversation.takenOverBy = owner._id;
        conversation.takenOverAt = takeover.createdAt;
      }
      conversations.push(conversation);
      touch(lastAt);

      if (spec.handoff) {
        const { reason, source, needs, budget, questions, concerns } = spec.handoff;
        const handoffAt = [...messages].reverse().find((m) => m.role === 'assistant').createdAt;
        lead.handoff = {
          reason,
          at: handoffAt,
          acknowledgedAt: takeover?.createdAt,
          summary: { needs, budget, questions, concerns, source },
        };
        if (owner) {
          outbox.push(
            outboxMessage(
              lead,
              'handoff_notice',
              { executive: owner.name, project: project.name },
              { at: handoffAt, dedupeKey: `handoff_notice:${conversationId}` },
            ),
          );
        }
      }
      if (spec.optedOut) {
        lead.optedOut = true;
        lead.optedOutAt = messages.findLast((m) => m.role === 'buyer').createdAt;
      }
    }

    if (spec.duplicateOf) {
      lead.possibleDuplicates.push({
        lead: specByKey.get(spec.duplicateOf.lead)._id,
        reason: spec.duplicateOf.reason,
        resolution: spec.duplicateOf.resolution ?? 'open',
        flaggedAt: spec.arrivedAt,
      });
    }

    applyLeadScore(lead, project);
    leads.push(lead);
  }

  // Merged duplicates: the kept lead gains the source touch, the email and a resolved flag.
  const leadById = new Map(leads.map((l) => [String(l._id), l]));
  for (const spec of specs.filter((s) => s.mergedInto)) {
    const dropped = leadById.get(String(spec._id));
    const kept = leadById.get(String(specByKey.get(spec.mergedInto)._id));
    dropped.mergedInto = kept._id;
    dropped.status = 'lost';
    kept.email ??= dropped.email;
    kept.sources.push({ source: dropped.primarySource, receivedAt: dropped.firstInboundAt });
    kept.possibleDuplicates.push({
      lead: dropped._id,
      reason: 'similar_name',
      resolution: 'merged',
      flaggedAt: dropped.firstInboundAt,
    });
    applyLeadScore(dropped, projectByCode.get(spec.project));
  }

  await insertAt(Slot, slotBook.all());
  await insertAt(Lead, leads);
  await insertAt(Visit, visits);
  await insertAt(Conversation, conversations);
  const sentMessages = outbox.filter(Boolean);
  await insertAt(Outbox, sentMessages);
  const spend = spendRows(leads.filter((l) => !l.mergedInto));
  await insertAt(SourceSpend, spend);
  await Counter.create({ _id: 'lead', seq: lastCode });

  return {
    staff: staffByKey.size,
    projects: projectDocs.length,
    leads: leads.filter((l) => !l.mergedInto).length,
    openDuplicates: leads.filter((l) => l.possibleDuplicates.some((d) => d.resolution === 'open'))
      .length,
    conversations: conversations.length,
    slots: slotBook.all().length,
    visits: visits.length,
    outbox: sentMessages.length,
    spendRows: spend.length,
  };
}
