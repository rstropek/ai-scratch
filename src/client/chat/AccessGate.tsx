// The chat until the school's access code is in: the KI-Helfer asks for it in its own speech bubble.
// Scratch beside it works already. App checks the code (src/client/access.ts) and then shows the chat.
import { KeyRound, LoaderCircle } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { normalizeCode } from '../../shared/access.ts';
import { ChatTopBar } from './ChatTopBar.tsx';
import { Bubble } from './MessageView.tsx';

export interface AccessGateProps {
  /** the code is being checked (typed in, from the link or remembered) */
  checking: boolean;
  /** why the last code didn't work */
  error?: string;
  /** prefills the field, e.g. a remembered code the server couldn't check */
  initialCode?: string;
  onCode: (code: string) => void;
  fontSize: number;
  onFontSize: (size: number) => void;
  onFold: () => void;
}

export const AccessGate = ({ checking, error, initialCode, onCode, fontSize, onFontSize, onFold }: AccessGateProps) => {
  const [code, setCode] = useState(initialCode ?? '');
  const normalized = normalizeCode(code);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (checking || !normalized) return;
    onCode(normalized);
  };
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ fontSize }}>
      <ChatTopBar fontSize={fontSize} onFontSize={onFontSize} onFold={onFold} />
      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-3 py-1" data-testid="access-gate">
        <div className="my-2.5 flex flex-col items-start">
          <Bubble from="assistant" testId="access-welcome">
            Hallo! Ich bin dein KI-Helfer. Bevor wir loslegen, brauche ich den Zugangscode, den du von deiner Lehrerin
            oder deinem Lehrer bekommen hast.
          </Bubble>
        </div>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2">
          <label htmlFor="access-code" className="flex items-center gap-1.5 font-bold [&_svg]:size-[1.1em]">
            <KeyRound aria-hidden className="text-primary" />
            Zugangscode
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="access-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={checking}
              // biome-ignore lint/a11y/noAutofocus: entering the code is the only thing the chat offers now
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'access-error' : undefined}
              className="min-w-[8em] flex-1 rounded-lg border bg-white px-3 py-1.5 transition-[border-color,box-shadow] duration-150 outline-none focus:border-primary focus:ring-4 focus:ring-ring disabled:opacity-60 aria-invalid:border-alert-border"
            />
            <Button
              type="submit"
              className="h-auto py-1.5 text-[length:inherit] font-bold focus-visible:ring-ring [&_svg]:size-[1em]"
              disabled={checking || !normalized}
            >
              {checking ? (
                <>
                  <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
                  prüfe…
                </>
              ) : (
                "Los geht's"
              )}
            </Button>
          </div>
          {error && (
            <p
              id="access-error"
              role="alert"
              className="rounded-lg border border-alert-border bg-alert px-3.5 py-2 text-[0.9em] text-foreground"
            >
              {error}
            </p>
          )}
        </form>
        <p className="mt-6 mb-2 text-[0.9em] text-muted-foreground">
          Scratch rechts kannst du schon jetzt ausprobieren.
        </p>
      </div>
    </div>
  );
};
