// The seven videos, one after the other: the day as a strip (each video as wide as it is long), one player,
// and "Weiter" to the next. The Beamer-Ansicht puts strip, player and buttons on the whole screen, so the
// projector shows nothing else (no codes, no Locker cards).
import { Check, ChevronLeft, ChevronRight, Maximize, Minimize, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LiveVideo } from '../../shared/live.ts';
import { remember, remembered } from './live-api.ts';
import { Section } from './Section.tsx';

const minutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`);

const rememberedWatched = (): Set<string> => {
  try {
    return new Set(JSON.parse(remembered('watched') ?? '[]') as string[]);
  } catch {
    return new Set();
  }
};

export const Videos = ({ videos }: { videos: LiveVideo[] }) => {
  const [current, setCurrent] = useState(() => {
    const i = videos.findIndex((v) => v.descriptId === remembered('video'));
    return Math.max(i, 0);
  });
  const [watched, setWatched] = useState(rememberedWatched);
  const stage = useRef<HTMLDivElement>(null);
  const [beamer, setBeamer] = useState(false);

  useEffect(() => {
    const onChange = () => setBeamer(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const video = videos[current];
  if (!video) return null;
  const next = videos[current + 1];
  const total = videos.reduce((sum, v) => sum + v.minutes, 0);

  const go = (i: number) => {
    setCurrent(i);
    remember('video', videos[i]?.descriptId);
  };
  const goNext = () => {
    const seen = new Set(watched).add(video.descriptId);
    setWatched(seen);
    remember('watched', JSON.stringify([...seen]));
    go(current + 1);
  };
  const toggleBeamer = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen();
  };

  const quiet = beamer ? 'border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white' : 'bg-card';

  return (
    <Section
      title="Videos"
      id="videos"
      aside={
        <p className="text-[0.9375rem] text-muted-foreground">
          {videos.length} Videos, zusammen etwa {minutes(total)}
        </p>
      }
    >
      <div
        ref={stage}
        className={cn('flex flex-col gap-4', beamer && 'h-screen bg-[#1c1830] px-8 pt-6 pb-6 text-white')}
      >
        <ol className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-soft" aria-label="Reihenfolge der Videos">
          {videos.map((v, i) => {
            const isCurrent = i === current;
            const seen = watched.has(v.descriptId);
            return (
              // as wide as its title at least, the rest of the row shared by length
              <li key={v.descriptId} className="flex" style={{ flex: `${v.minutes} 0 auto` }}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-[background-color,border-color] duration-150 outline-none focus-visible:ring-4 focus-visible:ring-ring',
                    beamer ? 'border-white/20 text-white/80 hover:border-white/50' : 'bg-card hover:border-primary',
                    seen &&
                      !isCurrent &&
                      (beamer ? 'bg-white/10' : 'border-transparent bg-primary-light text-primary-ink'),
                    isCurrent && 'border-primary bg-primary text-primary-foreground hover:border-primary',
                  )}
                >
                  <span className="flex w-full items-center gap-1.5 pr-0.5 font-bold">
                    <span className="tabular-nums">{i + 1}</span>
                    <span className="whitespace-nowrap">{v.title}</span>
                    {isCurrent ? (
                      <Play aria-hidden className="ml-auto size-3.5 shrink-0 fill-current" />
                    ) : (
                      seen && <Check aria-label="gesehen" className="ml-auto size-4 shrink-0" strokeWidth={3} />
                    )}
                  </span>
                  <span className={cn('text-[0.8125rem] tabular-nums', isCurrent ? 'text-white/85' : 'opacity-75')}>
                    {minutes(v.minutes)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className={cn(beamer && 'grid min-h-0 flex-1 place-items-center [container-type:size]')}>
          <div
            className={cn(
              'aspect-video overflow-hidden rounded-xl bg-black',
              beamer ? 'w-[min(100cqw,calc(100cqh*16/9))]' : 'w-full shadow-[0_2px_12px_hsla(225,30%,30%,0.18)]',
            )}
          >
            <iframe
              key={video.descriptId}
              src={`https://share.descript.com/embed/${video.descriptId}`}
              title={`Video ${current + 1}: ${video.title}`}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="size-full border-0"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            className={cn('h-11 px-4 text-base font-bold', quiet)}
            disabled={current === 0}
            onClick={() => go(current - 1)}
          >
            <ChevronLeft aria-hidden className="size-5" />
            Zurück
          </Button>
          <p className={cn('mx-auto px-2 text-[0.9375rem]', beamer ? 'text-white/80' : 'text-muted-foreground')}>
            Video {current + 1} von {videos.length}: <span className="font-bold">{video.title}</span>,{' '}
            {minutes(video.minutes)}
          </p>
          {document.fullscreenEnabled && (
            <Button variant="outline" className={cn('h-11 px-4 text-base font-bold', quiet)} onClick={toggleBeamer}>
              {beamer ? <Minimize aria-hidden className="size-5" /> : <Maximize aria-hidden className="size-5" />}
              {beamer ? 'Beamer-Ansicht beenden' : 'Beamer-Ansicht'}
            </Button>
          )}
          {next && (
            <Button className="h-11 px-5 text-base font-bold" onClick={goNext}>
              Weiter: {current + 2} {next.title}
              <ChevronRight aria-hidden className="size-5" />
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
};
