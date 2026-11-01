// The chat until access is in: the KI-Helfer asks for the access code in its own speech bubble and the kid types
// it in. Adults create codes in the office (OFFICE_URL); a line says so. Scratch beside it works already. App
// checks the code (src/client/access.ts) and then shows the chat.
import { KeyRound, LoaderCircle } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { normalizeCode } from '../../shared/access.ts';
import { ChatTopBar } from './ChatTopBar.tsx';
import { Bubble } from './MessageView.tsx';

/** where adults create codes */
export const OFFICE_URL = 'https://office.ai-scratch.dev';

export interface AccessGateProps {
  /** the code is being checked (typed in, from the link or remembered) */
  checking: boolean;
  /** why the last code didn't work */
  error?: string;
  /** prefills the field, e.g. a remembered code the server couldn't check */
  initialCode?: string;
  /** a normalized code */
  onCode: (code: string) => void;
  fontSize: number;
  onFontSize: (size: number) => void;
  onFold: () => void;
}

const SUBMIT = 'h-auto py-1.5 text-[length:inherit] font-bold focus-visible:ring-ring [&_svg]:size-[1em]';
const FIELD =
  'rounded-lg border bg-white px-3 py-1.5 transition-[border-color,box-shadow] duration-150 outline-none focus:border-primary focus:ring-4 focus:ring-ring disabled:opacity-60 aria-invalid:border-alert-border';

const Checking = ({ children }: { children: ReactNode }) => (
  <>
    <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
    {children}
  </>
);

const ErrorBox = ({ id, children }: { id: string; children: ReactNode }) => (
  <p id={id} role="alert" className="rounded-lg border border-alert-border bg-alert px-3.5 py-2 text-[0.9em]">
    {children}
  </p>
);

const AssistantSays = ({ children, testId }: { children: ReactNode; testId?: string }) => (
  <div className="my-2.5 flex flex-col items-start">
    <Bubble from="assistant" testId={testId}>
      {children}
    </Bubble>
  </div>
);

interface FormProps {
  checking: boolean;
  /** the server's answer to the last check */
  error?: string;
  initialCode: string;
  onCode: (code: string) => void;
}

const CodeForm = ({ checking, error, initialCode, onCode }: FormProps) => {
  const [code, setCode] = useState(initialCode);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (checking || !code.trim()) return;
    onCode(normalizeCode(code));
  };
  return (
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
          placeholder="TIGER-APFEL-48"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'access-error' : undefined}
          className={cn('min-w-[8em] flex-1 placeholder:text-[#8a8fa3]', FIELD)}
        />
        <Button type="submit" className={SUBMIT} disabled={checking || !code.trim()}>
          {checking ? <Checking>prüfe…</Checking> : "Los geht's"}
        </Button>
      </div>
      {error && <ErrorBox id="access-error">{error}</ErrorBox>}
    </form>
  );
};

export const AccessGate = ({ checking, error, initialCode, onCode, fontSize, onFontSize, onFold }: AccessGateProps) => (
  <div className="flex h-full min-h-0 flex-col" style={{ fontSize }}>
    <ChatTopBar fontSize={fontSize} onFontSize={onFontSize} onFold={onFold} />
    <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-3 py-1" data-testid="access-gate">
      <AssistantSays testId="access-welcome">
        Hallo! Ich bin dein KI-Helfer. Tipp den Zugangscode ein, den du bekommen hast, zum Beispiel von deiner Lehrerin
        oder deinem Lehrer.
      </AssistantSays>
      <CodeForm checking={checking} error={error} initialCode={initialCode ?? ''} onCode={onCode} />
      <p className="mt-6 text-[0.9em] text-muted-foreground">Scratch rechts kannst du schon jetzt ausprobieren.</p>
      <p className="mt-2 mb-2 text-[0.9em] text-muted-foreground">
        Für Erwachsene: Zugangscodes erstellen Sie unter{' '}
        <a
          href={OFFICE_URL}
          target="_blank"
          rel="noreferrer"
          className="text-primary-hover underline underline-offset-3 hover:text-primary-ink"
        >
          office.ai-scratch.dev
        </a>
        .
      </p>
    </div>
  </div>
);
