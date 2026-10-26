// The purple bar of Scratch's menu, as on the app: the event's name and, once chosen, the school.
import favicon from '../favicon.svg';

export const TopBar = ({ school }: { school?: string }) => (
  <header className="sticky top-0 z-10 bg-primary text-primary-foreground">
    <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-6">
      <img src={favicon} alt="" className="size-7 rounded-md bg-white/95 p-0.5" />
      <span className="font-bold tracking-[0.01em] whitespace-nowrap">Digitalferien 2026</span>
      <span className="hidden text-white/75 sm:inline">für Lehrkräfte</span>
      {school && <span className="ml-auto truncate font-bold">{school}</span>}
    </div>
  </header>
);
