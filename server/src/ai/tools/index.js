import { z } from 'zod';

import { bookVisit } from './bookVisit.js';
import { getFacts } from './getFacts.js';
import { getFreeSlots } from './getFreeSlots.js';
import { handoffToHuman } from './handoffToHuman.js';
import { updateLeadProfile } from './updateLeadProfile.js';

const TOOLS = [getFacts, updateLeadProfile, getFreeSlots, bookVisit, handoffToHuman];
const byName = new Map(TOOLS.map((tool) => [tool.name, tool]));

function toParameters(schema) {
  const parameters = z.toJSONSchema(schema, { io: 'input' });
  delete parameters.$schema;
  return parameters;
}

/** Tool definitions for the provider, generated from the same zod schemas that validate the calls. */
export const TOOL_DEFINITIONS = Object.freeze(
  TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toParameters(tool.schema),
  })),
);

function parseArguments(raw) {
  if (raw && typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return undefined;
  }
}

/**
 * Validates and runs one tool call from the model. Bad input never reaches a
 * tool: it comes back as an error result the model can correct. Unexpected
 * failures (database down) propagate so the agent can fall back.
 *
 * @returns {Promise<{ name: string, args: object, ok: boolean, result: object }>}
 */
export async function runTool(name, rawArguments, context) {
  const tool = byName.get(name);
  const args = parseArguments(rawArguments);
  // Rejected input is kept only as a short string: arbitrary model JSON is never stored as fields.
  const rejected = (error, extra = {}) => ({
    name: String(name).slice(0, 60),
    args: {
      raw: String(
        typeof rawArguments === 'string' ? rawArguments : JSON.stringify(rawArguments),
      ).slice(0, 500),
    },
    ok: false,
    result: { ok: false, error, ...extra },
  });

  if (!tool) return rejected(`Unknown tool: ${name}`);
  if (args === undefined) return rejected('Arguments were not valid JSON.');

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`);
    return rejected('Invalid arguments', { issues });
  }

  const result = await tool.run(parsed.data, context);
  return { name, args: parsed.data, ok: result.ok !== false, result };
}
