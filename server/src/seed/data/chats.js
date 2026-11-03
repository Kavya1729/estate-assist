import { fixedReply, greeting, handoffReply } from '../../ai/replies.js';
import { describeProject } from '../../ai/tools/getFacts.js';
import { formatRupeeRange } from '../../lib/money.js';
import { formatVisitTime } from '../../lib/time.js';

/**
 * Sample chats. Each script gets the seeded lead, project, owner and visit and
 * returns messages with `gap`, the seconds since the previous message. Tool
 * calls are stored the way the agent stores them, so the lead detail screen
 * shows them like a real chat.
 */

const configFor = (project, bhk) => project.configurations.find((c) => c.bhk === bhk);
const sizeOf = (c) => `${c.carpetAreaSqft.min}–${c.carpetAreaSqft.max} sq ft`;
const addressOf = (project) => `${project.location.address}, ${project.location.city}`;

const tool = (name, args, result) => ({ name, args, result, ok: result.ok !== false });
const factsCall = (project) =>
  tool(
    'get_facts',
    { projectCode: project.code },
    { ok: true, projects: [describeProject(project)] },
  );
const slotsCall = (project, visit, language) =>
  tool(
    'get_free_slots',
    { projectCode: project.code },
    {
      ok: true,
      project: project.code,
      slots: [
        {
          slotId: String(visit.slot),
          when: formatVisitTime(visit.startsAt, language),
          seatsLeft: 2,
        },
      ],
    },
  );
const bookCall = (project, visit, language) =>
  tool(
    'book_visit',
    { slotId: String(visit.slot) },
    {
      ok: true,
      visitId: String(visit._id),
      project: project.name,
      when: formatVisitTime(visit.startsAt, language),
      address: addressOf(project),
    },
  );

const buyer = (text, gap = 40) => ({ role: 'buyer', text, gap });
const assistant = (text, { gap = 4, toolCalls } = {}) => ({
  role: 'assistant',
  text,
  gap,
  toolCalls,
});

export const CHATS = {
  hardik: ({ lead, project, visit }) => {
    const c = configFor(project, 3);
    return [
      assistant(greeting('en', 'Hardik'), { gap: 6 }),
      buyer('Hi, I saw Project 1 on the portal. What is the price of a 3 BHK?'),
      assistant(
        `3 BHK homes at Project 1 have ${sizeOf(c)} of carpet area and are priced at ${formatRupeeRange(c.priceRange)}. These are base prices; GST, stamp duty and registration are extra. Does that fit your budget?`,
        {
          toolCalls: [
            tool('update_lead_profile', { projectCode: 'P1', bhk: 3 }, { ok: true }),
            factsCall(project),
          ],
        },
      ),
      buyer('Yes, around 1 crore. Is there a swimming pool and gym?', 55),
      assistant(
        'Yes, Project 1 has a swimming pool and a gym, along with a clubhouse, kids’ play area and jogging track. When are you planning to buy?',
        {
          toolCalls: [
            tool('update_lead_profile', { budgetMax: lead.profile.budgetMax }, { ok: true }),
          ],
        },
      ),
      buyer('Within 2-3 months. Can I see the site this weekend?', 35),
      assistant(
        `${formatVisitTime(visit.startsAt, 'en')} is free for a site visit. Shall I book it?`,
        {
          toolCalls: [
            tool('update_lead_profile', { timeline: '0-3m' }, { ok: true }),
            slotsCall(project, visit, 'en'),
          ],
        },
      ),
      buyer('Sunday 11 works, please book.', 25),
      assistant(
        `Done. Your visit to Project 1 is booked for ${formatVisitTime(visit.startsAt, 'en')} at ${addressOf(project)}. You will get a WhatsApp reminder a day before and 2 hours before.`,
        { toolCalls: [bookCall(project, visit, 'en')] },
      ),
    ];
  },

  nidhi: ({ project }) => {
    const c = configFor(project, 2);
    return [
      assistant(greeting('en', 'Nidhi'), { gap: 9 }),
      buyer('Hello, I want a 2 BHK in Project 2. When is possession?'),
      assistant(
        `Possession of Project 2 is planned for June 2027, as per its RERA registration. 2 BHK homes there are ${sizeOf(c)} and priced at ${formatRupeeRange(c.priceRange)}.`,
        {
          toolCalls: [
            tool('update_lead_profile', { projectCode: 'P2', bhk: 2 }, { ok: true }),
            factsCall(project),
          ],
        },
      ),
      buyer('Can you guarantee we get the keys before March? We have to move by then.', 70),
      {
        ...assistant(fixedReply('unverified', 'en')),
        flagged: true,
        flagReason: 'Unverified numbers: 4',
        blockedText: 'Yes, we can guarantee handover within 4 months, so you can move in by March.',
      },
    ];
  },

  rajesh: ({ owner }) => [
    assistant(greeting('en', 'Rajesh'), { gap: 5 }),
    buyer(
      'What is the best price you can do on a 3 BHK in Project 1? I can book this week if you give a discount.',
    ),
    assistant(handoffReply('en', owner.name, 'price_or_discount')),
  ],

  sneha: ({ project, owner }) => [
    assistant(greeting('en', 'Sneha'), { gap: 7 }),
    buyer('Are the 3 BHK flats east facing? And what is the carpet area?'),
    assistant(
      `Every apartment at Project 1 is east or north facing. 3 BHK homes have ${sizeOf(configFor(project, 3))} of carpet area.`,
      { toolCalls: [factsCall(project)] },
    ),
    buyer('Can I talk to someone? I want to discuss floor options.', 50),
    assistant(handoffReply('en', owner.name, 'buyer_requested')),
    { role: 'system', text: `${owner.name} took over the chat`, gap: 300 },
    {
      role: 'staff',
      author: owner,
      text: 'Hi Sneha, this is Ravi from the Project 1 team. Tower B has 3 BHK homes from the 4th to the 12th floor. When would you like to see the sample flat?',
      gap: 20,
    },
    buyer('Saturday evening maybe. I will confirm tomorrow.', 600),
    {
      role: 'staff',
      author: owner,
      text: 'Sure, I will keep a 5 pm option in mind and check with you tomorrow.',
      gap: 90,
    },
  ],

  vikram: ({ project, visit }) => {
    const c = configFor(project, 3);
    return [
      assistant(greeting('hi', 'Vikram'), { gap: 8 }),
      buyer('नमस्ते, Project 2 में 3 BHK की कीमत क्या है?'),
      assistant(
        `Project 2 में 3 BHK घर ${sizeOf(c)} कार्पेट एरिया के हैं और इनकी कीमत ${formatRupeeRange(c.priceRange)} है। GST, स्टांप ड्यूटी और रजिस्ट्रेशन अलग से हैं। क्या आप साइट देखना चाहेंगे?`,
        {
          toolCalls: [
            tool('update_lead_profile', { projectCode: 'P2', bhk: 3 }, { ok: true }),
            factsCall(project),
          ],
        },
      ),
      buyer('हाँ, इस हफ्ते किसी शाम को।', 45),
      assistant(`${formatVisitTime(visit.startsAt, 'hi')} खाली है। क्या मैं बुक कर दूँ?`, {
        toolCalls: [slotsCall(project, visit, 'hi')],
      }),
      buyer('हाँ, बुक कर दीजिए।', 30),
      assistant(
        `आपकी Project 2 की साइट विज़िट ${formatVisitTime(visit.startsAt, 'hi')} के लिए बुक हो गई है। पता: ${addressOf(project)}। एक दिन पहले और 2 घंटे पहले WhatsApp पर रिमाइंडर आएगा।`,
        { toolCalls: [bookCall(project, visit, 'hi')] },
      ),
    ];
  },

  bhavesh: ({ project, owner, lead }) => [
    assistant(greeting('gu', 'Bhavesh'), { gap: 6 }),
    buyer('Project 2 માં બાળકો માટે સ્કૂલ બસની સુવિધા છે?'),
    assistant(handoffReply('gu', owner.name, 'missing_fact'), {
      toolCalls: [
        factsCall(project),
        tool(
          'handoff_to_human',
          { reason: 'missing_fact', summary: { needs: lead.handoff.summary.needs } },
          { ok: true, handedOff: true, executive: owner.name },
        ),
      ],
    }),
  ],

  manish: ({ project }) => [
    assistant(greeting('en', 'Manish'), { gap: 5 }),
    buyer('Send me the price list for 2 BHK.'),
    assistant(
      `2 BHK homes at Project 1 are priced at ${formatRupeeRange(configFor(project, 2).priceRange)} (base price). Would you like to visit the site?`,
      { toolCalls: [factsCall(project)] },
    ),
    buyer('STOP', 3600),
    assistant(fixedReply('optedOut', 'en'), { gap: 1 }),
  ],

  /** Short chat for generated leads, in the lead's language. */
  generic: ({ lead, project, visit }) => {
    const language = lead.language;
    const c = configFor(project, lead.profile.bhk) ?? project.configurations[0];
    const price = formatRupeeRange(c.priceRange);
    const lines = {
      en: {
        ask: `What is the price of a ${c.bhk} BHK in ${project.name}?`,
        answer: `${c.bhk} BHK homes at ${project.name} are ${sizeOf(c)} and priced at ${price} (base price). Would you like to see the site?`,
        later: 'Thanks, I will discuss with my family and get back.',
        ok: 'Of course. Message here any time and I can book a visit for you.',
        visit: 'Yes, please book a visit.',
        booked: (when) => `Your site visit to ${project.name} is booked for ${when}.`,
      },
      hi: {
        ask: `${project.name} में ${c.bhk} BHK की कीमत क्या है?`,
        answer: `${project.name} में ${c.bhk} BHK घर ${sizeOf(c)} के हैं और इनकी कीमत ${price} है (बेस प्राइस)। क्या आप साइट देखना चाहेंगे?`,
        later: 'धन्यवाद, मैं परिवार से बात करके बताता हूँ।',
        ok: 'ज़रूर। जब चाहें यहाँ मैसेज करें, मैं विज़िट बुक कर दूँगा।',
        visit: 'हाँ, विज़िट बुक कर दीजिए।',
        booked: (when) => `आपकी ${project.name} की साइट विज़िट ${when} के लिए बुक हो गई है।`,
      },
      gu: {
        ask: `${project.name} માં ${c.bhk} BHK ની કિંમત શું છે?`,
        answer: `${project.name} માં ${c.bhk} BHK ઘર ${sizeOf(c)} ના છે અને કિંમત ${price} છે (બેઝ પ્રાઇસ). શું તમે સાઇટ જોવા માંગો છો?`,
        later: 'આભાર, હું પરિવાર સાથે વાત કરીને જણાવીશ.',
        ok: 'ચોક્કસ. ગમે ત્યારે અહીં મેસેજ કરો, હું વિઝિટ બુક કરી આપીશ.',
        visit: 'હા, વિઝિટ બુક કરી દો.',
        booked: (when) => `${project.name} ની તમારી સાઇટ વિઝિટ ${when} માટે બુક થઈ ગઈ છે.`,
      },
    }[language];

    const opening = [
      assistant(greeting(language, lead.name.split(' ')[0])),
      buyer(lines.ask),
      assistant(lines.answer, { toolCalls: [factsCall(project)] }),
    ];
    if (visit?.bookedVia === 'assistant') {
      return [
        ...opening,
        buyer(lines.visit, 60),
        assistant(lines.booked(formatVisitTime(visit.startsAt, language)), {
          toolCalls: [slotsCall(project, visit, language), bookCall(project, visit, language)],
        }),
      ];
    }
    return [...opening, buyer(lines.later, 90), assistant(lines.ok)];
  },
};
