// The video page: the workshop's videos, one after the other.
import { TopBar } from './TopBar.tsx';
import { minutes, Videos } from './Videos.tsx';
import { VIDEOS } from './video-list.ts';

export const LiveApp = () => (
  <div className="min-h-full">
    <TopBar />
    <main className="mx-auto max-w-6xl px-6 pt-10 pb-24">
      <section aria-labelledby="videos-title">
        <h1 id="videos-title" className="text-[1.875rem] leading-tight font-bold text-primary-ink">
          Die Videos zum Workshop-Tag
        </h1>
        <p className="mt-3 mb-6 max-w-[62ch] text-lg leading-relaxed">
          Los geht’s mit dem ersten Video, dann eines nach dem anderen. Alles Weitere wird in den Videos erklärt.{' '}
          {VIDEOS.length} Videos, zusammen etwa {minutes(VIDEOS.reduce((sum, v) => sum + v.minutes, 0))}.
        </p>
        <Videos videos={VIDEOS} />
      </section>
    </main>
  </div>
);
