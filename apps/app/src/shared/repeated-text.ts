// The model sometimes writes its explanation before a tool call and then again, word for word, after it.
// The kid should read it once, and the model shouldn't see itself repeating in later turns.

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Indexes of the texts (the text parts of one answer, in order; '' for other parts) that only repeat another
 * one: an earlier text that a later one contains, or a later text that is the start of an earlier one (the
 * repeat while it streams).
 */
export const repeatedTexts = (texts: string[]): Set<number> => {
  const norm = texts.map(normalize);
  const repeated = new Set<number>();
  norm.forEach((a, i) => {
    norm.slice(i + 1).forEach((b, k) => {
      if (!a || !b) return;
      if (a.length >= 20 && b.includes(a)) repeated.add(i);
      else if (a.startsWith(b)) repeated.add(i + 1 + k);
    });
  });
  return repeated;
};
