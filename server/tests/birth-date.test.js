import { describe, expect, it } from 'vitest';
import { parseBirthDate } from '../src/modules/auth/birth-date.js';

describe('parseBirthDate', () => {
  it('expands a 6 digit DDMMYY into both century candidates', () => {
    expect(parseBirthDate('120390')).toEqual({
      ok: true,
      input: '120390',
      candidates: ['1990-03-12', '2090-03-12'],
    });
  });

  it('strips separators a user is likely to type', () => {
    expect(parseBirthDate('12/03/90')).toMatchObject({ ok: true, input: '120390' });
  });

  it('keeps only the century where the date actually exists', () => {
    // 29 February 2000 is a real date, 1929 is not.
    expect(parseBirthDate('290200')).toEqual({
      ok: true,
      input: '290200',
      candidates: ['2000-02-29'],
    });
  });

  it.each(['310299', '320390', '000390', '120000', '121390'])('rejects %s as not a real date', (input) => {
    expect(parseBirthDate(input)).toEqual({ ok: false, reason: 'NOT_A_DATE' });
  });

  it.each(['', '1', '12345', '1234567', 'ab2900'])('rejects %j for wrong length', (input) => {
    expect(parseBirthDate(input)).toEqual({ ok: false, reason: 'FORMAT' });
  });
});
