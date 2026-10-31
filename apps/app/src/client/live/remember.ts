// What this browser remembers on the video page (the current video, the videos seen).
// Storage can be blocked (private windows, settings): then the page just forgets.

export const remembered = (key: string): string | undefined => {
  try {
    return localStorage.getItem(`digiferien.live.${key}`) ?? undefined;
  } catch {
    return undefined;
  }
};

export const remember = (key: string, value: string | undefined): void => {
  try {
    if (value === undefined) localStorage.removeItem(`digiferien.live.${key}`);
    else localStorage.setItem(`digiferien.live.${key}`, value);
  } catch {
    // not remembered
  }
};
