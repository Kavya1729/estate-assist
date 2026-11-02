import { HttpError } from './errors.js';

/**
 * Validates `body`, `query` and `params` against zod schemas before the handler
 * runs. Parsed (coerced, stripped) values are placed on `req.valid`; handlers
 * read only from there so unvalidated input never reaches the database.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const valid = {};
    const issues = [];

    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        valid[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ field: [part, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (issues.length) return next(new HttpError(400, 'Some fields are invalid.', issues));

    req.valid = valid;
    next();
  };
}
