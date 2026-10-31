// The chat until access is in: the KI-Helfer asks how the kid uses it, in its own speech bubble, and the kid
// picks one of two answers. With a school's code the kid types it in; with a parent's own OpenRouter key
// the next step is for the parents: the key, the terms of use (TermsDialog) and their consent. Scratch
// beside it works already. App checks the code or key (src/client/access.ts) and then shows the chat.
import {
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Heart,
  House,
  KeyRound,
  LoaderCircle,
  Lock,
  School,
  Users,
  Wallet,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isOpenRouterKey, normalizeCode } from '../../shared/access.ts';
import { ChatTopBar } from './ChatTopBar.tsx';
import { Bubble } from './MessageView.tsx';
import { TermsDialog } from './TermsDialog.tsx';

export type GatePath = 'school' | 'key';

export interface AccessGateProps {
  /** the code or key is being checked (typed in, from the link or remembered) */
  checking: boolean;
  /** why the last code or key didn't work */
  error?: string;
  /** prefills the field, e.g. a remembered code the server couldn't check */
  initialCode?: string;
  /** the path to open on; without it (and without initialCode) the kid chooses first */
  initialPath?: GatePath;
  /** the parent has agreed to the current terms already */
  initialAgreed?: boolean;
  /** a normalized code, or a trimmed key */
  onCode: (code: string) => void;
  fontSize: number;
  onFontSize: (size: number) => void;
  onFold: () => void;
}

const CHOICES: Record<GatePath, { answer: string; hint: string; icon: ReactNode }> = {
  school: {
    answer: 'Ich habe einen Zugangscode',
    hint: 'von meiner Lehrerin oder meinem Lehrer',
    icon: <School />,
  },
  key: {
    answer: 'Ich nutze einen eigenen Schlüssel',
    hint: 'einen OpenRouter-Schlüssel von meinen Eltern',
    icon: <House />,
  },
};

const CODE_IS_KEY =
  'Das ist ein OpenRouter-Schlüssel, kein Zugangscode. Tipp oben auf „ändern“ und wähle „Ich nutze einen eigenen Schlüssel“.';
const NOT_A_KEY =
  'Das ist kein OpenRouter-Schlüssel: Er beginnt mit sk-or-. Einen Zugangscode der Schule geben Sie über „ändern“ ein.';
const AGREE_FIRST = 'Bitte setzen Sie zuerst dieses Häkchen.';

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

const Choices = ({ onChoose }: { onChoose: (path: GatePath) => void }) => (
  <fieldset className="mt-1.5 grid gap-2">
    <legend className="sr-only">Wie möchtest du den KI-Helfer benutzen?</legend>
    {(Object.keys(CHOICES) as GatePath[]).map((path, i) => (
      <button
        key={path}
        type="button"
        onClick={() => onChoose(path)}
        // biome-ignore lint/a11y/noAutofocus: choosing is the only thing the chat offers now
        autoFocus={i === 0}
        className="flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_hsla(0,0%,0%,0.06)] transition-[border-color,background-color,box-shadow] duration-150 outline-none hover:border-primary hover:bg-primary-light/45 hover:shadow-[0_2px_6px_hsla(260,40%,40%,0.12)] focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring"
      >
        <span className="grid size-[2.3em] flex-none place-items-center rounded-[10px] bg-primary-light text-primary [&_svg]:size-[1.25em]">
          {CHOICES[path].icon}
        </span>
        <span className="min-w-0">
          <b className="block text-primary-ink">{CHOICES[path].answer}</b>
          <small className="mt-px block text-[0.85em] leading-snug text-muted-foreground">{CHOICES[path].hint}</small>
        </span>
        <ChevronRight aria-hidden className="ml-auto size-[1.1em] flex-none text-primary opacity-70" />
      </button>
    ))}
  </fieldset>
);

const RULES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <Wallet />, title: 'Sie tragen die Kosten.', text: 'Tragen Sie nur einen Schlüssel mit Ausgabelimit ein.' },
  {
    icon: <Globe />,
    title: 'Kein fester Ort:',
    text: 'Die KI kann die Daten auch außerhalb der EU verarbeiten, etwa in den USA.',
  },
  {
    icon: <Lock />,
    title: 'Keine persönlichen Daten:',
    text: 'keine Namen, Adressen, Fotos, Gesundheitsdaten oder Ähnliches.',
  },
  { icon: <Heart />, title: 'Sie erklären Ihrem Kind diese Regeln', text: 'und begleiten es bei der Nutzung.' },
];

interface FormProps {
  checking: boolean;
  /** the server's answer to the last check */
  error?: string;
  initialCode: string;
  onCode: (code: string) => void;
}

const SchoolForm = ({ checking, error, initialCode, onCode }: FormProps) => {
  const [code, setCode] = useState(initialCode);
  const [wrongKind, setWrongKind] = useState(false);
  const shown = wrongKind ? CODE_IS_KEY : error;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (checking || !code.trim()) return;
    if (isOpenRouterKey(code)) setWrongKind(true);
    else onCode(normalizeCode(code));
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
          onChange={(e) => {
            setCode(e.target.value);
            setWrongKind(false);
          }}
          disabled={checking}
          // biome-ignore lint/a11y/noAutofocus: entering the code is the only thing the chat offers now
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? 'access-error' : undefined}
          className={cn('min-w-[8em] flex-1', FIELD)}
        />
        <Button type="submit" className={SUBMIT} disabled={checking || !code.trim()}>
          {checking ? <Checking>prüfe…</Checking> : "Los geht's"}
        </Button>
      </div>
      {shown && <ErrorBox id="access-error">{shown}</ErrorBox>}
    </form>
  );
};

const KeyForm = ({ checking, error, initialCode, initialAgreed, onCode }: FormProps & { initialAgreed: boolean }) => {
  const [key, setKey] = useState(initialCode);
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(initialAgreed);
  const [agreeError, setAgreeError] = useState(false);
  const [notAKey, setNotAKey] = useState(false);
  const [terms, setTerms] = useState(false);
  const agreeBox = useRef<HTMLInputElement>(null);
  const ids = useId();
  const shown = notAKey ? NOT_A_KEY : error;
  const agree = (on: boolean) => {
    setAgreed(on);
    if (on) setAgreeError(false);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (checking || !key.trim()) return;
    if (!agreed) {
      setAgreeError(true);
      agreeBox.current?.focus();
    } else if (!isOpenRouterKey(key)) setNotAKey(true);
    else onCode(key.trim());
  };
  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="mt-3.5 overflow-hidden rounded-xl border bg-white shadow-[0_1px_3px_hsla(0,0%,0%,0.08)]"
      data-testid="parents-sheet"
    >
      <h2
        id={`${ids}-title`}
        className="flex items-center gap-2 border-b border-primary/18 bg-primary-light px-3.5 py-2 font-bold text-primary-ink [&_svg]:size-[1.1em] [&_svg]:text-primary"
      >
        <Users aria-hidden />
        Für Eltern: eigener KI-Schlüssel
      </h2>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-3.5 px-3.5 pt-3 pb-3.5 text-[0.94em] leading-[1.45]"
      >
        <p>
          Der KI-Helfer läuft dann über Ihr Konto bei{' '}
          <a
            href="https://openrouter.ai/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="text-primary-hover underline underline-offset-3 hover:text-primary-ink"
          >
            OpenRouter
          </a>
          . Legen Sie dort einen eigenen Schlüssel an und{' '}
          <b className="text-primary-ink">begrenzen Sie ihn auf einen kleinen Betrag</b>, zum Beispiel 5 $. Mehr kann
          nie ausgegeben werden.
        </p>
        <div className="flex flex-col gap-2">
          <label htmlFor="openrouter-key" className="flex items-center gap-1.5 font-bold [&_svg]:size-[1.1em]">
            <KeyRound aria-hidden className="text-primary" />
            OpenRouter-Schlüssel
          </label>
          <div className="relative flex">
            <input
              id="openrouter-key"
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setNotAKey(false);
              }}
              disabled={checking}
              // biome-ignore lint/a11y/noAutofocus: the parents come to enter the key
              autoFocus={!initialCode}
              placeholder="sk-or-v1-…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={shown ? true : undefined}
              aria-describedby={shown ? 'access-error' : undefined}
              className={cn('w-full min-w-0 pr-[2.6em] font-mono text-[0.9em] placeholder:text-[#8a8fa3]', FIELD)}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? 'Schlüssel verbergen' : 'Schlüssel anzeigen'}
              aria-pressed={show}
              className="absolute top-1/2 right-1 grid size-[2em] -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary-ink focus-visible:outline-2 focus-visible:outline-primary [&_svg]:size-[1.1em]"
            >
              {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </button>
          </div>
        </div>
        <div>
          <p className="mb-2 font-bold text-primary-ink">Das Wichtigste aus den Nutzungsbedingungen</p>
          <ul className="grid gap-[7px]">
            {RULES.map((rule) => (
              <li
                key={rule.title}
                className="grid grid-cols-[1.15em_1fr] items-start gap-2 [&_svg]:mt-[0.18em] [&_svg]:size-[1.05em] [&_svg]:text-primary"
              >
                {rule.icon}
                <span>
                  <b className="text-primary-ink">{rule.title}</b> {rule.text}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setTerms(true)}
            className="mt-2 text-primary-hover underline underline-offset-3 hover:text-primary-ink focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-primary"
          >
            Nutzungsbedingungen ganz lesen
          </button>
        </div>
        <label
          className={cn(
            'grid cursor-pointer grid-cols-[1.25em_1fr] items-start gap-2.5 rounded-[10px] px-3 py-2.5',
            agreeError ? 'bg-alert ring-1 ring-alert-border ring-inset' : 'bg-secondary',
          )}
        >
          <input
            ref={agreeBox}
            type="checkbox"
            checked={agreed}
            onChange={(e) => agree(e.target.checked)}
            disabled={checking}
            aria-invalid={agreeError ? true : undefined}
            aria-describedby={agreeError ? `${ids}-agree` : undefined}
            className="mt-[0.1em] size-[1.25em] cursor-pointer accent-primary"
          />
          <span>
            Ich bin volljährig, habe die Nutzungsbedingungen gelesen und stimme ihnen zu.
            {agreeError && (
              <b id={`${ids}-agree`} role="alert" className="mt-1 block text-warn-strong">
                {AGREE_FIRST}
              </b>
            )}
          </span>
        </label>
        <div className="flex flex-col gap-2">
          <Button type="submit" className={cn(SUBMIT, 'py-2.5')} disabled={checking || !key.trim()}>
            {checking ? <Checking>prüfe den Schlüssel…</Checking> : 'Schlüssel prüfen und starten'}
          </Button>
          {shown && <ErrorBox id="access-error">{shown}</ErrorBox>}
          <p className="text-[0.9em] leading-snug text-muted-foreground">
            Der Schlüssel bleibt nur in diesem Browser gespeichert. Auf einem fremden Computer löschen Sie ihn danach
            mit „Schlüssel vergessen“ oben im Chat.
          </p>
        </div>
      </form>
      {terms && (
        <TermsDialog
          onClose={() => setTerms(false)}
          onAgree={() => {
            setTerms(false);
            agree(true);
          }}
        />
      )}
    </section>
  );
};

export const AccessGate = ({
  checking,
  error,
  initialCode,
  initialPath,
  initialAgreed = false,
  onCode,
  fontSize,
  onFontSize,
  onFold,
}: AccessGateProps) => {
  const [path, setPath] = useState<GatePath | undefined>(
    () => initialPath ?? (initialCode ? (isOpenRouterKey(initialCode) ? 'key' : 'school') : undefined),
  );
  // the field's start value and the server's answer belong to the path they came with
  const [fresh, setFresh] = useState(false);
  const form = { checking, error: fresh ? undefined : error, initialCode: fresh ? '' : (initialCode ?? ''), onCode };
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ fontSize }}>
      <ChatTopBar fontSize={fontSize} onFontSize={onFontSize} onFold={onFold} />
      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-3 py-1" data-testid="access-gate">
        <AssistantSays testId="access-welcome">
          Hallo! Ich bin dein KI-Helfer. Wie möchtest du mich heute benutzen?
        </AssistantSays>
        {!path ? (
          <Choices onChoose={setPath} />
        ) : (
          <>
            <div className="my-2.5 flex flex-col items-end">
              <Bubble from="user">{CHOICES[path].answer}</Bubble>
              <button
                type="button"
                disabled={checking}
                onClick={() => {
                  setPath(undefined);
                  setFresh(true);
                }}
                className="mt-1 rounded-xs px-1 py-0.5 text-[0.85em] text-primary-hover underline underline-offset-3 hover:text-primary-ink focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              >
                ändern
              </button>
            </div>
            {path === 'school' ? (
              <>
                <AssistantSays>
                  Super! Tipp den Zugangscode ein, den du von deiner Lehrerin oder deinem Lehrer bekommen hast.
                </AssistantSays>
                <SchoolForm {...form} />
              </>
            ) : (
              <>
                <AssistantSays>
                  Okay! Der nächste Schritt ist für deine Eltern. Hol sie bitte kurz zu dir.
                </AssistantSays>
                <KeyForm {...form} initialAgreed={initialAgreed} />
              </>
            )}
          </>
        )}
        <p className="mt-6 mb-2 text-[0.9em] text-muted-foreground">
          Scratch rechts kannst du schon jetzt ausprobieren.
        </p>
      </div>
    </div>
  );
};
