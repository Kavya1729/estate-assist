import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { ROLES } from '../constants/domain.js';
import { toJSON } from './plugins/toJSON.js';

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      unique: true,
    },
    passwordHash: { type: String, required: true, select: false, private: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.SALES_EXECUTIVE },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, isActive: 1 });
userSchema.plugin(toJSON);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, BCRYPT_ROUNDS);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
