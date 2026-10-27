// The purple bar of Scratch's menu, as on the app, with the event's name.
import favicon from '../favicon.svg';

export const TopBar = () => (
  <header className="sticky top-0 z-10 bg-primary text-primary-foreground">
    <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-6">
      <img src={favicon} alt="" className="size-7 rounded-md bg-white/95 p-0.5" />
      <span className="font-bold tracking-[0.01em] whitespace-nowrap">Digitalferien 2026</span>
    </div>
  </header>
);
