// Turns chat errors into short German messages for kids.

export const OFFLINE = 'Keine Verbindung zum Server. Prüfe das Internet und versuch es nochmal.';

/** The server answers errors as JSON {error: "…"} in German; useChat puts the body into the message. */
export const kidFriendlyError = (error: Error): string => {
  try {
    const parsed: unknown = JSON.parse(error.message);
    if (parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {
    // not JSON: a network or stream error
  }
  if (/fetch|network/i.test(error.message)) return OFFLINE;
  return 'Da ist etwas schiefgegangen. Versuch es bitte nochmal.';
};
