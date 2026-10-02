type Named = { namaLengkap: string };

/**
 * Names that belong to more than one participant in the same batch.
 *
 * The participant form identifies people by name rather than by code, because a
 * code is something they have to still be holding. A name shared by two people
 * cannot identify either of them, so those few rows still show their code as a
 * tie breaker. Matching is case and whitespace insensitive: "Budi Santoso" and
 * "budi santoso " are the same person as far as a picker is concerned, and
 * treating them as different would hide a real collision.
 */
export const duplicatedNames = (peserta: Named[]): Set<string> => {
  const counts = new Map<string, number>();
  for (const item of peserta) {
    const key = item.namaLengkap.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name),
  );
};