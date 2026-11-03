import { Router } from 'express';

import { requireBuyer } from '../middleware/buyerAuth.js';
import { chatMessageLimiter, chatStartLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { signBuyerToken } from '../services/authService.js';
import { bookBuyerVisit, cancelBuyerVisit, getBuyerVisit } from '../services/buyerVisitService.js';
import {
  getBuyerMessages,
  handleBuyerMessage,
  startBuyerSession,
} from '../services/conversationService.js';
import { ingestLead } from '../services/leadService.js';
import { buyerVisitSchema, chatMessageSchema, startChatSchema } from '../validators/chat.js';

const router = Router();

const succeeded = (reply, toolName) =>
  Boolean(reply?.toolCalls?.some((call) => call.name === toolName && call.ok));

/**
 * A buyer starts a chat from the website. The enquiry goes through the same
 * ingest path as every other source, so duplicates are merged. In production
 * the phone would be verified with a WhatsApp OTP; here the session only shows
 * messages from this session onwards.
 */
router.post(
  '/sessions',
  chatStartLimiter,
  validate({ body: startChatSchema }),
  async (req, res) => {
    const since = Date.now();
    const { lead } = await ingestLead('website', req.valid.body);
    await startBuyerSession({ leadId: lead._id });

    const token = signBuyerToken(lead, { since });
    const chat = await getBuyerMessages({ leadId: lead._id, since: new Date(since) });
    res.status(201).json({ token, ...chat });
  },
);

router.get('/messages', requireBuyer, async (req, res) => {
  res.json(await getBuyerMessages(req.buyer));
});

/**
 * `offerSlots` tells the chat to open the inline slot picker (the assistant
 * just looked up free slots); `visitBooked` that the assistant booked one.
 */
router.post(
  '/messages',
  chatMessageLimiter,
  requireBuyer,
  validate({ body: chatMessageSchema }),
  async (req, res) => {
    const { mode, reply } = await handleBuyerMessage({
      leadId: req.buyer.leadId,
      text: req.valid.body.text,
    });
    res.json({
      mode,
      reply: reply && { role: reply.role, text: reply.text, createdAt: reply.createdAt },
      offerSlots: succeeded(reply, 'get_free_slots'),
      visitBooked: succeeded(reply, 'book_visit'),
    });
  },
);

router.get('/visit', requireBuyer, async (req, res) => {
  res.json({ visit: await getBuyerVisit(req.buyer.leadId) });
});

/** Books (or moves) the buyer's visit to the slot picked in the chat. */
router.post(
  '/visit',
  chatMessageLimiter,
  requireBuyer,
  validate({ body: buyerVisitSchema }),
  async (req, res) => {
    res.status(201).json({ visit: await bookBuyerVisit(req.buyer.leadId, req.valid.body.slotId) });
  },
);

router.delete('/visit', chatMessageLimiter, requireBuyer, async (req, res) => {
  res.json({ visit: await cancelBuyerVisit(req.buyer.leadId) });
});

export default router;
