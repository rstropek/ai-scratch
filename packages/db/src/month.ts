// Budgets count per calendar month in Vienna (docs/budgets.md). A month is `2026-11`.

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Vienna',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const viennaParts = (date: Date) =>
  Object.fromEntries(parts.formatToParts(date).map((p) => [p.type, Number(p.value)])) as Record<string, number>;

/** the Vienna month a moment falls in */
export const viennaMonth = (date: Date): string => {
  const p = viennaParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
};

/** the first moment of a Vienna month (midnight on the 1st is never inside a daylight saving switch) */
const monthStart = (year: number, month: number): Date => {
  const guess = new Date(Date.UTC(year, month - 1, 1));
  const p = viennaParts(guess);
  const wall = Date.UTC(p.year as number, (p.month as number) - 1, p.day, p.hour, p.minute, p.second);
  return new Date(guess.getTime() - (wall - guess.getTime()));
};

/** a Vienna month as [start, end) */
export const monthRange = (month: string): { start: Date; end: Date } => {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return { start: monthStart(year, m), end: m === 12 ? monthStart(year + 1, 1) : monthStart(year, m + 1) };
};
