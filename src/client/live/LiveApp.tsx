// The teacher page: its code first (remembered in this browser), then the page.
import { KeyRound, LoaderCircle } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { LiveData } from '../../shared/live.ts';
import { LivePage } from './LivePage.tsx';
import { loadLive, remember, remembered } from './live-api.ts';
import { TopBar } from './TopBar.tsx';

const ERRORS = {
  wrong: 'Dieser Code passt nicht. Er steht in der E-Mail zu den Digitalferien 2026.',
  unset: 'Die Seite ist noch nicht eingerichtet. Bitte Rainer Bescheid geben.',
  offline: 'Der Server ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.',
};

type State = { at: 'checking' } | { at: 'gate'; error?: string } | { at: 'page'; data: LiveData; code: string };

export const LiveApp = () => {
  const [state, setState] = useState<State>(() => (remembered('code') ? { at: 'checking' } : { at: 'gate' }));

  const open = async (code: string, typed: boolean) => {
    setState({ at: 'checking' });
    const result = await loadLive(code);
    if (result.ok) {
      remember('code', code);
      setState({ at: 'page', data: result.data, code });
      return;
    }
    // a remembered code that no longer fits is forgotten without a word
    if (result.error === 'wrong') remember('code', undefined);
    setState({ at: 'gate', error: typed || result.error !== 'wrong' ? ERRORS[result.error] : undefined });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, for the code this browser remembers
  useEffect(() => {
    const code = remembered('code');
    if (code) void open(code, false);
  }, []);

  if (state.at === 'page') return <LivePage data={state.data} code={state.code} />;
  return (
    <Gate
      checking={state.at === 'checking'}
      error={state.at === 'gate' ? state.error : undefined}
      onCode={(code) => void open(code, true)}
    />
  );
};

const Gate = ({ checking, error, onCode }: { checking: boolean; error?: string; onCode: (code: string) => void }) => {
  const [code, setCode] = useState('');
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!checking && code.trim()) onCode(code.trim());
  };
  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <main className="flex flex-1 items-start justify-center px-4 pt-[14vh] pb-12">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-xl bg-card p-7 shadow-[0_2px_12px_hsla(225,30%,40%,0.12)]"
        >
          <h1 className="text-[1.375rem] leading-tight font-bold text-primary-ink">Zugang für Lehrkräfte</h1>
          <p className="mt-2 leading-relaxed">
            Videos, Zugangscodes und Locker-Karten für den Workshop-Tag. Der Code dafür steht in der E-Mail.
          </p>
          <label htmlFor="live-code" className="mt-6 flex items-center gap-1.5 font-bold text-primary-ink">
            <KeyRound aria-hidden className="size-[1.1em] text-primary" />
            Zugangscode
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="live-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={checking}
              // biome-ignore lint/a11y/noAutofocus: the code is the only thing this screen asks for
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'live-error' : undefined}
              className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-base transition-[border-color,box-shadow] duration-150 outline-none focus:border-primary focus:ring-4 focus:ring-ring disabled:opacity-60 aria-invalid:border-alert-border"
            />
            <Button type="submit" className="h-auto px-5 py-2 text-base font-bold" disabled={checking || !code.trim()}>
              {checking ? (
                <>
                  <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
                  prüfe…
                </>
              ) : (
                'Öffnen'
              )}
            </Button>
          </div>
          {error && (
            <p id="live-error" role="alert" className="mt-3 rounded-lg border border-alert-border bg-alert px-3.5 py-2">
              {error}
            </p>
          )}
        </form>
      </main>
    </div>
  );
};
