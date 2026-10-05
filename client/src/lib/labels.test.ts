import { describe, expect, it } from 'vitest';
import { ambiguousLabels, isAmbiguous } from './labels.js';

/*
  The pickers identify people by name, so a name shared by two entries cannot
  identify either of them and those rows fall back to showing their code. This
  decides which rows those are, which means a miss here either hides a collision or
  exposes a code nobody needed to see.
*/
describe('ambiguousLabels', () => {
  it('returns nothing when every label is unique', () => {
    expect(ambiguousLabels(['Joko', 'Siti', 'Andi']).size).toBe(0);
  });

  it('finds the label that appears twice', () => {
    expect([...ambiguousLabels(['Joko', 'Budi Santoso', 'Budi Santoso'])]).toEqual(['budi santoso']);
  });

  it('finds a label that appears three times', () => {
    expect(ambiguousLabels(['Budi', 'Budi', 'Budi']).has('budi')).toBe(true);
  });

  it('treats case and stray whitespace as the same person', () => {
    expect(ambiguousLabels(['Budi Santoso', ' budi santoso ']).has('budi santoso')).toBe(true);
  });

  it('does not confuse labels that merely share a prefix', () => {
    expect(ambiguousLabels(['Budi', 'Budiman']).size).toBe(0);
  });

  it('handles an empty or single-entry list', () => {
    expect(ambiguousLabels([]).size).toBe(0);
    expect(ambiguousLabels(['Joko']).size).toBe(0);
  });

  it('keys on the normalised label, not the original spelling', () => {
    // The caller looks up with the same normalisation; returning the raw spelling
    // would never match and the hint would stay hidden.
    const result = ambiguousLabels(['BUDI', 'budi']);
    expect([...result].every((label) => label === label.trim().toLowerCase())).toBe(true);
    expect(result.has('BUDI')).toBe(false);
  });
});

describe('isAmbiguous', () => {
  it('matches regardless of case and padding, which is how the row looks it up', () => {
    const set = ambiguousLabels(['Budi Santoso', 'budi santoso']);
    expect(isAmbiguous('BUDI SANTOSO', set)).toBe(true);
    expect(isAmbiguous('  Budi Santoso  ', set)).toBe(true);
  });

  it('is false for a name that only appears once', () => {
    const set = ambiguousLabels(['Budi', 'Siti']);
    expect(isAmbiguous('Budi', set)).toBe(false);
  });
});
