// Access codes (one per school) are typed in by kids: case and surrounding spaces don't matter.
export const normalizeCode = (code: string): string => code.trim().toLowerCase();
