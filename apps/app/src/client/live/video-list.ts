// The seven videos of the workshop day, in order. They are public, so the list sits in the bundle.

export interface LiveVideo {
  /** share.descript.com/view/<id>, embedded as share.descript.com/embed/<id> */
  descriptId: string;
  title: string;
  minutes: number;
}

export const VIDEOS: LiveVideo[] = [
  { descriptId: 'f2IzzeDMeT2', title: 'Einleitung', minutes: 31 },
  { descriptId: 'k0pT94GUl5w', title: 'Scratch', minutes: 34 },
  { descriptId: 'vTrb22DOYcM', title: 'KI', minutes: 36 },
  { descriptId: 'wo28L2FezSe', title: 'Eigenes Spiel', minutes: 15 },
  { descriptId: '8Q1VNdlN0Wy', title: 'Chatbot', minutes: 17 },
  { descriptId: 'OWktZYpIjKn', title: 'TypeScript', minutes: 12 },
  { descriptId: '8YFON3wFO7L', title: 'Abschluss', minutes: 2 },
];

/**
 * The video a link opens: `?video=3` is the third video, counted from 1 as the page shows them (the office links
 * there). Anything else opens none, so the page falls back to the one this browser remembers.
 */
export const videoFromSearch = (search: string, count: number): number | undefined => {
  const raw = new URLSearchParams(search).get('video');
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= 1 && n <= count ? n - 1 : undefined;
};
