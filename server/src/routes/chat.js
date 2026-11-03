import { Router } from 'express';

import { requireBuyer } from '../middleware/buyerAuth.js';
import { chatMessageLimiter, chatStartLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { signBuyerToken } from '../services/authService.js';
import {
  getBuyerMessages,
  handleBuyerMessage,
  startBuyerSession,
} from '../services/conversationService.js';
import { ingestLead } from '../services/leadService.js';
import { chatMessageSchema, startChatSchema } from '../validators/chat.js';

const router = Router();

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
    const { mode, messages } = await getBuyerMessages({ leadId: lead._id, since: new Date(since) });
    res.status(201).json({ token, buyer: { name: lead.name }, mode, messages });
  },
);

router.get('/messages', requireBuyer, async (req, res) => {
  res.json(await getBuyerMessages(req.buyer));
});

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
    });
  },
);

export default router;
