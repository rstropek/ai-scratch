// The event page: the videos for everyone on top, below them the teachers' part behind its code (remembered in
// this browser).
import { LoaderCircle, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { LiveData, LiveSchool, LiveVideo } from '../../shared/live.ts';
import { loadLive, loadVideos, remember, remembered } from './live-api.ts';
import { Section } from './Section.tsx';
import { TeacherArea, TeacherGate } from './TeacherArea.tsx';
import { TopBar } from './TopBar.tsx';
import { minutes, Videos } from './Videos.tsx';

const ERRORS = {
  wrong: 'Dieser Code passt nicht. Er steht in der E-Mail zu den Digitalferien 2026.',
  unset: 'Dieser Bereich ist noch nicht eingerichtet. Bitte Rainer Bescheid geben.',
  offline: 'Der Server ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.',
};

type Teacher = { at: 'locked'; error?: string } | { at: 'checking' } | { at: 'open'; data: LiveData; code: string };

/** ?schule= in the link wins over the school this browser remembers */
const initialSchool = (schools: LiveSchool[]): LiveSchool | undefined => {
  const id = new URL(location.href).searchParams.get('schule') ?? remembered('school');
  return schools.find((s) => s.id === id);
};

export const LiveApp = () => {
  const [videos, setVideos] = useState<LiveVideo[] | 'loading' | 'failed'>('loading');
  const [teacher, setTeacher] = useState<Teacher>(() => (remembered('code') ? { at: 'checking' } : { at: 'locked' }));
  const [school, setSchool] = useState<LiveSchool>();

  const fetchVideos = async () => {
    setVideos('loading');
    setVideos((await loadVideos()) ?? 'failed');
  };

  const unlock = async (code: string, typed: boolean) => {
    setTeacher({ at: 'checking' });
    const result = await loadLive(code);
    if (result.ok) {
      remember('code', code);
      setSchool(initialSchool(result.data.schools));
      setTeacher({ at: 'open', data: result.data, code });
      return;
    }
    // a remembered code that no longer fits is forgotten without a word
    if (result.error === 'wrong') remember('code', undefined);
    setTeacher({ at: 'locked', error: typed || result.error !== 'wrong' ? ERRORS[result.error] : undefined });
  };

  const lock = () => {
    remember('code', undefined);
    setSchool(undefined);
    setTeacher({ at: 'locked' });
    const url = new URL(location.href);
    url.searchParams.delete('schule');
    history.replaceState(history.state, '', url);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on the first render
  useEffect(() => {
    void fetchVideos();
    const code = remembered('code');
    if (code) void unlock(code, false);
  }, []);

  // the address names the school, so the page can be bookmarked or passed on per school
  useEffect(() => {
    if (teacher.at !== 'open') return;
    remember('school', school?.id);
    const url = new URL(location.href);
    if (school) url.searchParams.set('schule', school.id);
    else url.searchParams.delete('schule');
    history.replaceState(history.state, '', url);
  }, [school, teacher.at]);

  return (
    <div className="min-h-full">
      <TopBar school={teacher.at === 'open' ? school?.name : undefined} />
      <main className="mx-auto max-w-6xl px-6 pt-10 pb-24">
        <section aria-labelledby="videos-title">
          <h1 id="videos-title" className="text-[1.875rem] leading-tight font-bold text-primary-ink">
            Die Videos zum Workshop-Tag
          </h1>
          <p className="mt-3 mb-6 max-w-[62ch] text-lg leading-relaxed">
            Los geht’s mit dem ersten Video, dann eines nach dem anderen. Alles Weitere wird in den Videos erklärt.
            {Array.isArray(videos) &&
              ` ${videos.length} Videos, zusammen etwa ${minutes(videos.reduce((sum, v) => sum + v.minutes, 0))}.`}
          </p>
          {videos === 'loading' ? (
            <div className="grid aspect-video place-items-center rounded-xl bg-card text-muted-foreground">
              <LoaderCircle aria-label="Videos laden" className="size-8 animate-spin motion-reduce:animate-none" />
            </div>
          ) : videos === 'failed' ? (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-alert-border bg-alert px-6 py-5">
              <p className="flex-1">Die Videos lassen sich gerade nicht laden.</p>
              <Button variant="outline" className="h-10 bg-card px-4 font-bold" onClick={() => void fetchVideos()}>
                <RotateCw aria-hidden />
                Noch einmal versuchen
              </Button>
            </div>
          ) : (
            <Videos videos={videos} />
          )}
        </section>

        <div className="mt-20 border-t border-[hsla(225,20%,40%,0.2)] pt-2">
          <Section title="Für Lehrkräfte" id="lehrkraefte">
            {teacher.at === 'open' ? (
              <TeacherArea data={teacher.data} code={teacher.code} school={school} onSchool={setSchool} onLock={lock} />
            ) : (
              <TeacherGate
                checking={teacher.at === 'checking'}
                error={teacher.at === 'locked' ? teacher.error : undefined}
                onCode={(code) => void unlock(code, true)}
              />
            )}
          </Section>
        </div>
      </main>
    </div>
  );
};
