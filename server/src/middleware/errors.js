import { HttpError } from '../lib/httpError.js';

export function notFound(req, _res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function fromValidationError(err) {
  const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  return new HttpError(400, 'Some fields are invalid.', details);
}

export function errorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err);
  if (err.name === 'ValidationError' && err.errors) err = fromValidationError(err);
  if (err.name === 'CastError') err = new HttpError(400, `Invalid ${err.path}.`);

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
