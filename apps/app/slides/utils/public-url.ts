// Slides name files in public/ from the root ("/art/robot.svg"); the built deck is served under /slides/,
// so a path handed to a component at runtime gets Vite's base in front (Vite only rewrites static URLs).
export const publicUrl = (src: string): string => (src.startsWith('/') ? import.meta.env.BASE_URL + src.slice(1) : src);
