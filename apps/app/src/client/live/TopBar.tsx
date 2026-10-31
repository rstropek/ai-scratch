// The purple bar of Scratch's menu, as on the app, with the event's name and the slide deck (/slides/).
import { Presentation } from 'lucide-react';
import favicon from '../favicon.svg';

export const TopBar = () => (
  <header className="sticky top-0 z-10 bg-primary text-primary-foreground">
    <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-6">
      <img src={favicon} alt="" className="size-7 rounded-md bg-white/95 p-0.5" />
      <span className="font-bold tracking-[0.01em] whitespace-nowrap">Digitalferien 2026</span>
      {/* a new tab, so the video keeps playing where it was */}
      <a
        href="/slides/"
        target="_blank"
        rel="noopener"
        className="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 font-bold transition-colors duration-150 outline-none hover:bg-white/15 focus-visible:ring-4 focus-visible:ring-white/50"
      >
        <Presentation aria-hidden className="size-4" />
        Slides
      </a>
    </div>
  </header>
);
