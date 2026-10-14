'use strict';

/**
 * Strict ISO-8601 with a REQUIRED timezone designator (Z or +hh:mm).
 *
 * Why strict?  `new Date("2026-10-15T20:00:00")` (no timezone) is interpreted in the
 * SERVER's local time, so the same request would run at different moments on different
 * machines. Requiring a timezone removes that ambiguity.
 */
const ISO_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const MAX_NAME_LENGTH = 200;

/**
 * `new Date("2026-02-30T10:00:00Z")` silently becomes March 2nd, so a plain isNaN check
 * is not enough. We round-trip year/month/day through Date.UTC to catch impossible dates.
 */
function isRealCalendarDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * Returns { errors: string[], value?: { taskName, executeAt: Date, payload } }.
 * All problems are collected (not just the first) so the client can fix everything in one go.
 */
function validateCreateTask(body, nowMs = Date.now()) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object'] };
  }

  const errors = [];
  const { taskName, executeAt, payload } = body;

  // --- taskName ---
  if (typeof taskName !== 'string' || taskName.trim() === '') {
    errors.push('taskName is required and must be a non-empty string');
  } else if (taskName.trim().length > MAX_NAME_LENGTH) {
    errors.push(`taskName must be at most ${MAX_NAME_LENGTH} characters`);
  }

  // --- executeAt ---
  let executeDate;
  const match = typeof executeAt === 'string' ? ISO_REGEX.exec(executeAt) : null;
  if (!match) {
    errors.push('executeAt is required and must be an ISO-8601 string with timezone, e.g. 2026-10-15T15:00:00Z');
  } else if (
    !isRealCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])) ||
    Number.isNaN((executeDate = new Date(executeAt)).getTime())
  ) {
    errors.push('executeAt is not a valid date/time');
  } else if (executeDate.getTime() <= nowMs) {
    errors.push('executeAt must be in the future');
  }

  // --- payload (optional) ---
  if (payload !== undefined && payload !== null && (typeof payload !== 'object' || Array.isArray(payload))) {
    errors.push('payload, if provided, must be a JSON object');
  }

  if (errors.length > 0) return { errors };
  return { errors, value: { taskName: taskName.trim(), executeAt: executeDate, payload } };
}

module.exports = { validateCreateTask };
