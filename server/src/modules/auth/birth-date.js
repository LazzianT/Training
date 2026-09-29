/**
 * The HR system is asked for, and staff are told to type, a 6 digit DDMMYY
 * birth date. A 2 digit year is ambiguous across centuries, so this returns
 * every real calendar date the input could mean and lets the database decide.
 * Non-existent dates such as 310299 are rejected rather than rolled over.
 */
const CENTURIES = [1900, 2000];

const toIsoDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isRealDate ? date.toISOString().slice(0, 10) : null;
};

export const parseBirthDate = (raw) => {
  const input = String(raw).replace(/\D/g, '');
  if (input.length !== 6) return { ok: false, reason: 'FORMAT' };

  const day = Number(input.slice(0, 2));
  const month = Number(input.slice(2, 4));
  const year2 = Number(input.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, reason: 'NOT_A_DATE' };

  const candidates = CENTURIES.map((century) => toIsoDate(century + year2, month, day)).filter(
    (value) => value !== null,
  );

  return candidates.length > 0 ? { ok: true, candidates, input } : { ok: false, reason: 'NOT_A_DATE' };
};
