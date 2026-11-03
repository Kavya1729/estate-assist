import { z } from 'zod';

export const objectId = (label = 'id') =>
  z.string({ error: `Provide a ${label}` }).regex(/^[a-f\d]{24}$/i, `Invalid ${label}`);

export const idParamsSchema = z.object({ id: objectId() });
