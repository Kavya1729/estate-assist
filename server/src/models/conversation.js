import mongoose from 'mongoose';

import { CONVERSATION_CHANNELS, MESSAGE_ROLES } from '../constants/domain.js';
import { toJSON } from './plugins/toJSON.js';

export const MAX_MESSAGES_PER_CONVERSATION = 200;

const toolCallSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    args: { type: mongoose.Schema.Types.Mixed },
    result: { type: mongoose.Schema.Types.Mixed },
    ok: { type: Boolean, default: true },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: MESSAGE_ROLES, required: true },
    text: { type: String, required: true, maxlength: 4000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    toolCalls: { type: [toolCallSchema], default: undefined },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, maxlength: 200 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

messageSchema.plugin(toJSON);

const conversationSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    channel: { type: String, enum: CONVERSATION_CHANNELS, default: 'web' },

    /** `ai` while the assistant replies; `human` once a sales executive takes over. */
    mode: { type: String, enum: ['ai', 'human'], default: 'ai' },
    takenOverBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    takenOverAt: { type: Date },

    messages: {
      type: [messageSchema],
      default: [],
      validate: {
        validator: (messages) => messages.length <= MAX_MESSAGES_PER_CONVERSATION,
        message: `A conversation can hold at most ${MAX_MESSAGES_PER_CONVERSATION} messages`,
      },
    },

    flagged: { type: Boolean, default: false },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

conversationSchema.index({ lead: 1, channel: 1 }, { unique: true });
conversationSchema.index({ flagged: 1, reviewedAt: 1, lastMessageAt: -1 });
conversationSchema.index({ lastMessageAt: -1 });

conversationSchema.plugin(toJSON);

export const Conversation = mongoose.model('Conversation', conversationSchema);
