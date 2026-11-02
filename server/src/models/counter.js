import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true },
  },
  { versionKey: false },
);

export const Counter = mongoose.model('Counter', counterSchema);

/** Atomically returns the next number in a named sequence; the first call returns `start + 1`. */
export async function nextSequence(name, { start = 0, session } = {}) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session },
  );
  return start + counter.seq;
}
