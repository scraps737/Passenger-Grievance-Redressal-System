import { ApiError } from '../utils/ApiError.js';

/**
 * Validates req[source] against a zod schema, replacing the source with the
 * parsed value. Zod strips unknown keys by default, so this doubles as an
 * input-sanitisation boundary.
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    req[source] = result.data;
    return next();
  };
}

/** Coerces and validates query params (page/limit numeric) before handlers run. */
export function parsePagination(defaultLimit = 20, maxLimit = 100) {
  return (req, _res, next) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(req.query.limit, 10) || defaultLimit));
    req.pagination = { page, limit, skip: (page - 1) * limit };
    return next();
  };
}
