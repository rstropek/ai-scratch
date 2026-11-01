// Access codes come from the office (TIGER-APFEL-48) and are typed in by kids: case, spaces around them and a space
// instead of a dash don't matter. The same rule as @ai-scratch/db's normalizeCode, which the server applies.
export const normalizeCode = (code: string): string => code.trim().toLowerCase().replace(/\s+/g, '-');

/** GET /api/access: what the chat shows of the code */
export interface AccessInfo {
  /** ISO time; null for test codes */
  endsAt: string | null;
  /** the "frage KI" block works with this code */
  ask: boolean;
}
