import { HttpError } from '../lib/httpError.js';

export function notFound(req, _res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err);

  const status = Number.isInteger(err.status) && err.status >= 400 ? err.status : 500;
  if (status >= 500) console.error(err);

  let message = err.message;
  if (status >= 500) message = 'Something went wrong. Please try again.';
  else if (err.type === 'entity.parse.failed') message = 'Request body is not valid JSON.';
  else if (err.type === 'entity.too.large') message = 'Request body is too large.';

  res.status(status).json({
    error: message,
    ...(err.details && { details: err.details }),
  });
}
