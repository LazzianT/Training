import { describe, expect, it } from 'vitest';
import { duplicatedNames } from './peserta.js';

/*
  The picker identifies participants by name, so a name shared by two people
  cannot identify either of them and those rows fall back to showing a code. This
  decides which rows those are, which means a miss here either hides a collision
  or exposes a code nobody needed to see.
*/
describe('duplicatedNames', () => {
  it('returns nothing when every name is unique', () => {
    const result = duplicatedNames([
      { namaLengkap: 'Joko' },
      { namaLengkap: 'Siti' },
      { namaLengkap: 'Andi' },
    ]);
    expect(result.size).toBe(0);
  });

  it('finds the name that appears twice', () => {
    const result = duplicatedNames([
      { namaLengkap: 'Joko' },
      { namaLengkap: 'Budi Santoso' },
      { namaLengkap: 'Budi Santoso' },
    ]);
    expect([...result]).toEqual(['budi santoso']);
  });

  it('finds all three when a name appears three times', () => {
    const result = duplicatedNames([
      { namaLengkap: 'Budi' },
      { namaLengkap: 'Budi' },
      { namaLengkap: 'Budi' },
    ]);
    expect(result.has('budi')).toBe(true);
  });

  it('treats case and stray whitespace as the same person', () => {
    // Two rows differing only in case are one person to a picker. Treating them
    // as different would leave a real collision unresolved and show no code.
    const result = duplicatedNames([{ namaLengkap: 'Budi Santoso' }, { namaLengkap: ' budi santoso ' }]);
    expect(result.has('budi santoso')).toBe(true);
  });

  it('does not confuse names that merely share a prefix', () => {
    const result = duplicatedNames([{ namaLengkap: 'Budi' }, { namaLengkap: 'Budiman' }]);
    expect(result.size).toBe(0);
  });

  it('handles an empty or single entry roster', () => {
    expect(duplicatedNames([]).size).toBe(0);
    expect(duplicatedNames([{ namaLengkap: 'Joko' }]).size).toBe(0);
  });

  it('keys on the normalised name, not the original spelling', () => {
    // The caller looks up with the same normalisation; returning the raw spelling
    // would never match and the code would stay hidden.
    const result = duplicatedNames([{ namaLengkap: 'BUDI' }, { namaLengkap: 'budi' }]);
    expect([...result].every((name) => name === name.trim().toLowerCase())).toBe(true);
    expect(result.has('BUDI')).toBe(false);
  });
});
