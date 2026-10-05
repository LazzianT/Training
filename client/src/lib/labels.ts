/**
 * Labels that belong to more than one entry in a list.
 *
 * Used by the pickers, which identify people by name rather than by code. A name
 * shared by two people cannot identify either of them, so those few rows fall back
 * to showing their code as a tie breaker. Matching is case and whitespace
 * insensitive: two rows differing only in case are one person as far as a picker is
 * concerned, and treating them as different would hide a real collision.
 */
export const ambiguousLabels = (labels: string[]): Set<string> => {
  const counts = new Map<string, number>();
  for (const label of labels) {
    const key = label.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
};

/** Whether this particular label is one of the ambiguous ones. */
export const isAmbiguous = (label: string, ambiguous: Set<string>) =>
  ambiguous.has(label.trim().toLowerCase());
