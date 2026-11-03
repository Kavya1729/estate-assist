import { z } from 'zod';

export const objectId = (label = 'id') =>
  z.string({ error: `Provide a ${label}` }).regex(/^[a-f\d]{24}$/i, `Invalid ${label}`);

export const idParamsSchema = z.object({ id: objectId() });

/** A real calendar date as `YYYY-MM-DD` (rejects 2026-02-30, which Date.parse would roll over). */
export const isoDate = () =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Use a date like 2026-11-04', abort: true })
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, 'Enter a real date');
