import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import { ROLES } from '../../src/constants/domain.js';
import { createMockProvider } from '../../src/ai/providers/mockProvider.js';
import { Conversation, Lead } from '../../src/models/index.js';
import { signBuyerToken } from '../../src/services/authService.js';
import { handleBuyerMessage, openConversation } from '../../src/services/conversationService.js';
import { authHeader } from '../helpers/auth.js';
import { useTestDatabase } from '../helpers/db.js';
import { createLead, createProject, createStaff } from '../helpers/factories.js';

useTestDatabase();

const app = createApp();

let project;
let ravi;
let amit;
let head;
let lead;

beforeEach(async () => {
  project = await createProject();
  ravi = await createStaff({ projects: [project._id] });
  amit = await createStaff({ name: 'Amit Rana', email: 'amit@estate.test' });
  head = await createStaff({
    name: 'Meera Desai',
    email: 'meera@estate.test',
    role: ROLES.SALES_HEAD,
  });
  lead = await createLead(project, { name: 'Nidhi Shah', assignedTo: ravi._id });
  await openConversation({ leadId: lead._id });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const post = (user, url, body = {}) => request(app).post(url).set(authHeader(user)).send(body);
const conversation = () => Conversation.findOne({ lead: lead._id });

describe('taking over a chat', () => {
  it('stops the assistant and records who took over', async () => {
    const res = await post(ravi, `/api/leads/${lead.id}/takeover`);

    expect(res.status).toBe(200);
    expect(res.body.conversation).toMatchObject({ mode: 'human', takenOverBy: ravi.id });

    const provider = createMockProvider({ script: [] });
    const result = await handleBuyerMessage({ leadId: lead._id, text: 'Hello?', provider });
    expect(result.reply).toBeNull();
    expect(provider.calls).toHaveLength(0);
  });

  it('acknowledges a pending handoff', async () => {
    await Lead.updateOne(
      { _id: lead._id },
      { $set: { handoff: { reason: 'buyer_requested', at: new Date() } } },
    );

    await post(ravi, `/api/leads/${lead.id}/takeover`);

    expect((await Lead.findById(lead._id)).handoff.acknowledgedAt).toBeInstanceOf(Date);
  });

  it('is not allowed for a colleague', async () => {
    expect((await post(amit, `/api/leads/${lead.id}/takeover`)).status).toBe(403);
  });
});

describe('staff replies', () => {
  it('reach the buyer’s chat and take the chat over', async () => {
    const res = await post(ravi, `/api/leads/${lead.id}/messages`, {
      text: 'Hi Nidhi, Ravi here. When can I call you?',
    });
    expect(res.status).toBe(201);

    const token = signBuyerToken(lead, { since: 0 });
    const buyerView = await request(app)
      .get('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`);

    expect(buyerView.body.mode).toBe('human');
    expect(buyerView.body.messages.at(-1)).toMatchObject({
      role: 'staff',
      text: 'Hi Nidhi, Ravi here. When can I call you?',
    });
    expect(buyerView.body.messages.some((m) => m.role === 'system')).toBe(false);

    const stored = await conversation();
    expect(stored.messages.at(-1).author.toString()).toBe(ravi.id);
    expect(stored.messages.some((m) => m.role === 'system' && /took over/.test(m.text))).toBe(true);
  });

  it('reject empty text', async () => {
    expect((await post(ravi, `/api/leads/${lead.id}/messages`, { text: ' ' })).status).toBe(400);
  });
});

describe('handing back', () => {
  it('lets the assistant reply again', async () => {
    await post(ravi, `/api/leads/${lead.id}/takeover`);

    const res = await post(ravi, `/api/leads/${lead.id}/handback`);
    expect(res.body.conversation.mode).toBe('ai');

    const provider = createMockProvider({ script: [{ content: 'Happy to help again!' }] });
    const result = await handleBuyerMessage({ leadId: lead._id, text: 'Thanks', provider });
    expect(result.reply.text).toBe('Happy to help again!');
  });
});

describe('review queue', () => {
  async function flagReply() {
    const provider = createMockProvider({
      script: [{ content: 'Possession is in March 2025, guaranteed.' }],
    });
    await handleBuyerMessage({ leadId: lead._id, text: 'When is possession?', provider });
  }

  it('lists chats with a blocked reply, showing what the model tried to say', async () => {
    await flagReply();

    const res = await request(app).get('/api/reviews').set(authHeader(ravi));

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      lead: { id: lead.id, code: lead.code, name: 'Nidhi Shah', assignedTo: 'Ravi Mehta' },
      flaggedMessages: [
        expect.objectContaining({
          blockedText: 'Possession is in March 2025, guaranteed.',
          flagReason: 'Unverified numbers: 2025',
        }),
      ],
    });
  });

  it('shows executives only their own leads’ chats', async () => {
    await flagReply();
    expect((await request(app).get('/api/reviews').set(authHeader(amit))).body.items).toEqual([]);
    expect((await request(app).get('/api/reviews').set(authHeader(head))).body.items).toHaveLength(
      1,
    );
  });

  it('removes a reviewed chat until it is flagged again', async () => {
    await flagReply();
    const { id } = (await request(app).get('/api/reviews').set(authHeader(head))).body.items[0];

    expect((await post(head, `/api/reviews/${id}/resolve`)).status).toBe(200);
    expect((await request(app).get('/api/reviews').set(authHeader(head))).body.items).toEqual([]);

    await flagReply();
    expect((await request(app).get('/api/reviews').set(authHeader(head))).body.items).toHaveLength(
      1,
    );
  });
});
