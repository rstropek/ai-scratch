// The Locker dialog (docs/locker.md), opened from the two entries in Scratch's Datei menu. Built like
// Scratch's own prompt ("Neue Variable"): purple header, blue overlay, Abbrechen / OK, so kids meet a
// dialog they know. The kid types the code from their Locker sticker once per tab, then names the game
// (saving under an existing name replaces it) or picks one to load.
import { Check, CloudOff, ExternalLink, Inbox, Info, KeyRound, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import {
  findGame,
  formatLockerCode,
  isLockerCode,
  LOCKER_CODE_LENGTH,
  type LockerAction,
  type LockerGame,
  lockerPageUrl,
  MAX_GAME_NAME,
  normalizeLockerCode,
} from '../../shared/locker.ts';
import {
  forgetLockerCode,
  type LockerApi,
  LockerCallError,
  type LockerProject,
  NEED_ACCESS_CODE,
  openLockerPage,
  savedLabel,
  storedLockerCode,
  storeLockerCode,
} from './locker.ts';

const TITLE: Record<LockerAction, string> = {
  save: 'Im Locker speichern',
  load: 'Aus dem Locker laden',
  open: 'Locker in neuem Tab öffnen',
};
const CANT_OPEN = 'Dieses Spiel lässt sich nicht öffnen. Vielleicht ist die Datei kaputt.';
const SAVE_FAILED = 'Das Speichern hat nicht geklappt. Versuch es bitte nochmal.';
const LOCKER_DOWN = 'Der Locker antwortet gerade nicht. Versuch es gleich nochmal.';

type View =
  | { kind: 'nocode' }
  | { kind: 'code'; error?: string }
  | { kind: 'opening' }
  | { kind: 'down' }
  | { kind: 'save' }
  | { kind: 'saved'; name: string }
  | { kind: 'load' }
  /** open: the browser blocked the new tab, so a real link opens it */
  | { kind: 'link' };

export interface LockerDialogProps {
  action: LockerAction;
  /** without it the kid has no school code yet */
  api: LockerApi | undefined;
  project: LockerProject;
  /** the KI-Helfer is changing the project: loading waits */
  aiBusy: boolean;
  onClose: () => void;
}

const Button = ({
  primary,
  warn,
  className,
  ...props
}: ComponentProps<'button'> & { primary?: boolean; warn?: boolean }) => (
  <button
    type="button"
    className={cn(
      'inline-flex items-center gap-2 rounded px-4 py-3 text-sm leading-none font-semibold transition-colors duration-150',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-55',
      primary
        ? warn
          ? 'bg-warn-strong text-white enabled:hover:bg-warn-strong-hover'
          : 'bg-primary text-primary-foreground enabled:hover:bg-primary-hover'
        : 'border bg-background text-foreground enabled:hover:bg-secondary',
      '[&_svg]:size-4',
      className,
    )}
    {...props}
  />
);

const Buttons = ({ children, center }: { children: ReactNode; center?: boolean }) => (
  <div className={cn('mt-1 flex gap-2', center ? 'justify-center' : 'justify-end')}>{children}</div>
);

const Spinner = () => <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />;

/** A state that is one message: icon, headline, a sentence. */
const Message = ({
  icon,
  tone,
  title,
  children,
}: {
  icon: ReactNode;
  tone: 'ok' | 'muted' | 'alert';
  title: string;
  children: ReactNode;
}) => (
  <div className="grid justify-items-center gap-2 pt-1.5 text-center">
    <span
      className={cn(
        'mb-1 grid size-13 place-items-center rounded-full [&_svg]:size-7',
        tone === 'ok' && 'bg-success text-white',
        tone === 'muted' && 'bg-secondary text-muted-foreground',
        tone === 'alert' && 'bg-alert text-warn-strong',
      )}
    >
      {icon}
    </span>
    <strong className="text-lg text-primary-ink" role={tone === 'ok' ? 'status' : undefined}>
      {title}
    </strong>
    <p className="max-w-[32ch] text-[0.9rem] text-muted-foreground">{children}</p>
  </div>
);

const Note = ({ quiet, children }: { quiet?: boolean; children: ReactNode }) => (
  <div
    className={cn(
      'flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm [&_svg]:mt-px [&_svg]:size-4.5 [&_svg]:flex-none',
      quiet
        ? 'border-transparent bg-secondary [&_svg]:text-muted-foreground'
        : 'border-alert-border bg-alert [&_svg]:text-warn-strong',
    )}
    role={quiet ? undefined : 'status'}
  >
    {children}
  </div>
);

const ErrorText = ({ children }: { children?: string }) =>
  children ? (
    <p className="-mt-1.5 text-sm text-warn-strong" role="alert">
      {children}
    </p>
  ) : null;

const fieldClass =
  'h-12 w-full rounded-[5px] border bg-background px-4 text-base text-foreground placeholder:text-[#8a8fa1] focus:border-primary focus:shadow-[0_0_0_4px_var(--ring)] focus:outline-none disabled:bg-secondary/50';

export const LockerDialog = ({ action, api, project, aiBusy, onClose }: LockerDialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = useId();
  // opening the Locker's page needs no school code: it doesn't go through our server
  const [view, setView] = useState<View>(() =>
    action === 'open'
      ? { kind: storedLockerCode() ? 'link' : 'code' }
      : !api
        ? { kind: 'nocode' }
        : storedLockerCode()
          ? { kind: 'opening' }
          : { kind: 'code' },
  );
  const [code, setCode] = useState(() => storedLockerCode() ?? '');
  const [games, setGames] = useState<LockerGame[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);
  // the field to type into, whenever the view changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs for each new view, which the DOM query reads
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [view.kind]);

  const fail = (e: unknown, fallback: string): string => {
    if (e instanceof LockerCallError) {
      if (e.kind === 'access') setView({ kind: 'nocode' });
      return e.message;
    }
    console.error('locker', e);
    return fallback;
  };

  /** Opens the Locker with `lockerCode`: lists its games, then shows the save or load view. */
  const open = useCallback(
    async (lockerCode: string, typed: boolean) => {
      if (!api) return;
      setError(undefined);
      if (typed) setBusy(true);
      else setView({ kind: 'opening' });
      try {
        const list = await api.list(lockerCode);
        storeLockerCode(lockerCode);
        setCode(lockerCode);
        setGames(list);
        if (action === 'save') setName(project.title());
        if (action !== 'open') setView({ kind: action });
      } catch (e) {
        if (!(e instanceof LockerCallError)) console.error('locker', e);
        const message = e instanceof LockerCallError ? e.message : LOCKER_DOWN;
        if (e instanceof LockerCallError && e.kind === 'access') setView({ kind: 'nocode' });
        else if (e instanceof LockerCallError && e.kind === 'not-found') {
          forgetLockerCode();
          setView({ kind: 'code', error: message });
        } else setView(typed ? { kind: 'code', error: message } : { kind: 'down' });
      } finally {
        setBusy(false);
      }
    },
    [api, action, project],
  );

  const started = useRef(false);
  useEffect(() => {
    // once, also under StrictMode's double effects
    if (started.current) return;
    started.current = true;
    const stored = storedLockerCode();
    if (api && stored && action !== 'open') void open(stored, false);
  }, [api, open, action]);

  const otherCode = () => {
    forgetLockerCode();
    setCode('');
    setError(undefined);
    setView({ kind: 'code' });
  };

  const match = view.kind === 'save' ? findGame(games, name) : undefined;

  const save = async () => {
    if (!api || !name.trim() || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const saveAs = match?.name ?? name.trim();
      setGames(await api.save(code, saveAs, await project.sb3(), match));
      project.setTitle(saveAs);
      setView({ kind: 'saved', name: saveAs });
    } catch (e) {
      setError(fail(e, SAVE_FAILED));
    } finally {
      setBusy(false);
    }
  };

  const chosen = games.find((g) => g.fileId === selected);
  const load = async () => {
    if (!api || !chosen || busy || aiBusy) return;
    setBusy(true);
    setError(undefined);
    try {
      const data = await api.load(code, chosen);
      await project.load(data, chosen.name);
      onClose();
    } catch (e) {
      setError(fail(e, CANT_OPEN));
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (view.kind === 'code' && action === 'open' && isLockerCode(code)) {
      // right in the click, so the browser allows the tab; a wrong code gets the Locker site's own message
      storeLockerCode(code);
      if (openLockerPage(code)) onClose();
      else setView({ kind: 'link' });
      return;
    }
    if (view.kind === 'code' && isLockerCode(code) && !busy) void open(code, true);
    if (view.kind === 'save') void save();
    if (view.kind === 'load') void load();
  };

  const lockerLine = (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>Dein Locker</span>
      <span className="rounded-[5px] bg-primary-light px-1.5 py-0.5 font-mono text-[0.85rem] tracking-wider text-primary-ink">
        {formatLockerCode(code)}
      </span>
      <button
        type="button"
        onClick={otherCode}
        disabled={busy}
        className="ml-auto text-primary-hover underline underline-offset-3 focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-primary"
      >
        Anderer Code
      </button>
    </div>
  );
  const cancel = (
    <Button onClick={onClose} disabled={busy}>
      Abbrechen
    </Button>
  );

  const body = (): ReactNode => {
    switch (view.kind) {
      case 'nocode':
        return (
          <>
            <Message icon={<KeyRound />} tone="muted" title="Zuerst den Zugangscode">
              {NEED_ACCESS_CODE}
            </Message>
            <Buttons center>
              <Button primary onClick={onClose} data-autofocus>
                OK
              </Button>
            </Buttons>
          </>
        );
      case 'link':
        return (
          <>
            {lockerLine}
            <Message icon={<ExternalLink />} tone="muted" title="Dein Locker im Browser">
              Dort siehst du alle deine Dateien und kannst sie herunterladen.
            </Message>
            <Buttons center>
              {cancel}
              <a
                href={lockerPageUrl(code)}
                target="_blank"
                rel="noopener"
                onClick={onClose}
                data-autofocus
                className="inline-flex items-center gap-2 rounded bg-primary px-4 py-3 text-sm leading-none font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&_svg]:size-4"
              >
                Locker öffnen
                <ExternalLink aria-hidden />
              </a>
            </Buttons>
          </>
        );
      case 'opening':
        return (
          <div className="grid justify-items-center gap-3 py-6 text-muted-foreground [&_svg]:size-7" role="status">
            <Spinner />
            Dein Locker geht auf …
          </div>
        );
      case 'down':
        return (
          <>
            <Message icon={<CloudOff />} tone="alert" title="Der Locker antwortet gerade nicht">
              Versuch es gleich nochmal. Dein Projekt ist noch da. Du kannst es auch mit{' '}
              <b>Datei → Auf deinem Computer speichern</b> sichern.
            </Message>
            <Buttons center>
              {cancel}
              <Button primary onClick={() => void open(code, false)} data-autofocus>
                Nochmal versuchen
              </Button>
            </Buttons>
          </>
        );
      case 'code':
        return (
          <>
            <label className="font-medium" htmlFor={`${ids}-code`}>
              Tipp deinen Locker-Code ein.
            </label>
            <p className="-mt-2 text-sm text-muted-foreground">Die acht Zeichen auf deinem Locker-Sticker.</p>
            <input
              id={`${ids}-code`}
              data-autofocus
              className={cn(
                fieldClass,
                'h-14 text-center font-mono text-2xl tracking-[0.18em] uppercase',
                view.error && 'border-destructive',
              )}
              value={formatLockerCode(code)}
              onChange={(e) => {
                setCode(normalizeLockerCode(e.target.value));
                if (view.error) setView({ kind: 'code' });
              }}
              placeholder="XXXX XXXX"
              maxLength={LOCKER_CODE_LENGTH + 1}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              aria-invalid={view.error ? true : undefined}
            />
            <ErrorText>{view.error}</ErrorText>
            <Buttons>
              {cancel}
              <Button primary type="submit" disabled={busy || !isLockerCode(code)}>
                {busy && <Spinner />}
                {busy ? 'Wird geöffnet …' : 'Locker öffnen'}
              </Button>
            </Buttons>
          </>
        );
      case 'save':
        return (
          <>
            {lockerLine}
            <label className="font-medium" htmlFor={`${ids}-name`}>
              Wie heißt dein Spiel?
            </label>
            <input
              id={`${ids}-name`}
              data-autofocus
              className={fieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Fang die Fledermaus"
              maxLength={MAX_GAME_NAME}
              autoComplete="off"
              disabled={busy}
            />
            {match && (
              <Note>
                <TriangleAlert aria-hidden />
                <span>„{match.name}“ ist schon in deinem Locker. Wenn du speicherst, wird es ersetzt.</span>
              </Note>
            )}
            {games.length > 0 && (
              <>
                <p className="-mb-1.5 text-sm font-medium">Schon in deinem Locker</p>
                <div className={LIST}>
                  {games.map((g) => (
                    <GameRow
                      key={g.fileId}
                      game={g}
                      match={g === match}
                      disabled={busy}
                      onPick={() => setName(g.name)}
                    />
                  ))}
                </div>
              </>
            )}
            <ErrorText>{error}</ErrorText>
            <Buttons>
              {cancel}
              <Button primary warn={!!match && !busy} type="submit" disabled={busy || !name.trim()}>
                {busy && <Spinner />}
                {busy ? 'Wird gespeichert …' : match ? 'Ersetzen' : 'Speichern'}
              </Button>
            </Buttons>
          </>
        );
      case 'saved':
        return (
          <>
            <Message icon={<Check strokeWidth={3} />} tone="ok" title="Gespeichert!">
              „{view.name}“ ist jetzt in deinem Locker. Du kannst es später mit <b>Datei → Aus dem Locker laden</b>{' '}
              wieder öffnen.
            </Message>
            <Buttons center>
              <Button primary onClick={onClose} data-autofocus>
                Fertig
              </Button>
            </Buttons>
          </>
        );
      case 'load':
        if (games.length === 0)
          return (
            <>
              {lockerLine}
              <Message icon={<Inbox />} tone="muted" title="Dein Locker ist noch leer">
                Speichere zuerst ein Spiel mit <b>Datei → Im Locker speichern</b>.
              </Message>
              <Buttons center>
                <Button primary onClick={onClose} data-autofocus>
                  OK
                </Button>
              </Buttons>
            </>
          );
        return (
          <>
            {lockerLine}
            <fieldset className="min-w-0">
              <legend className="mb-3.5 font-medium">Welches Spiel willst du öffnen?</legend>
              <div className={LIST}>
                {games.map((g, i) => (
                  <GameChoice
                    key={g.fileId}
                    game={g}
                    group={`${ids}-game`}
                    checked={g === chosen}
                    disabled={busy}
                    autoFocus={i === 0}
                    onChoose={() => setSelected(g.fileId)}
                  />
                ))}
              </div>
            </fieldset>
            <Note quiet>
              <Info aria-hidden />
              <span>
                {aiBusy
                  ? 'Warte, bis der KI-Helfer fertig ist. Dann kannst du laden.'
                  : 'Das Projekt, das gerade offen ist, wird dabei ersetzt.'}
              </span>
            </Note>
            <ErrorText>{error}</ErrorText>
            <Buttons>
              {cancel}
              <Button primary type="submit" disabled={busy || aiBusy || !chosen}>
                {busy && <Spinner />}
                {busy ? 'Wird geladen …' : 'Laden'}
              </Button>
            </Buttons>
          </>
        );
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${ids}-title`}
      // Escape: closes, but not halfway through a save or load
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="mx-auto mt-[12vh] w-[440px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border-4 border-white/25 bg-transparent bg-clip-padding p-0 text-base text-foreground backdrop:bg-modal-overlay"
    >
      <div className="relative grid h-[50px] place-items-center bg-primary text-primary-foreground">
        <h2 id={`${ids}-title`} className="text-base font-normal">
          {TITLE[action]}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Schließen"
          className="absolute top-[11px] right-2.5 grid size-7 place-items-center rounded-full bg-black/15 shadow-[0_0_0_2px_rgba(0,0,0,0.15)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 [&_svg]:size-3.5"
        >
          <X strokeWidth={3.2} aria-hidden />
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3.5 bg-background px-8 pt-5.5 pb-6">
        {body()}
      </form>
    </dialog>
  );
};

const LIST = 'scrollbar-soft max-h-[232px] overflow-auto rounded-lg border';
const ROW = 'flex w-full items-center gap-3 border-t px-3.5 py-2.5 text-left first:border-t-0';
const rowTone = (on: boolean) => (on ? 'bg-primary-light text-primary-ink' : 'bg-background');

const SavedAt = ({ game, on }: { game: LockerGame; on: boolean }) => (
  <span
    className={cn('text-[0.8rem] whitespace-nowrap tabular-nums', on ? 'text-primary-ink' : 'text-muted-foreground')}
  >
    {savedLabel(game.savedAt)}
  </span>
);

/** Save: a game in the Locker; a click takes over its name. */
const GameRow = ({
  game,
  match,
  disabled,
  onPick,
}: {
  game: LockerGame;
  match: boolean;
  disabled: boolean;
  onPick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={match}
    disabled={disabled}
    onClick={onPick}
    className={cn(
      ROW,
      rowTone(match),
      !match && 'enabled:hover:bg-secondary',
      'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
    )}
  >
    <span className="min-w-0 flex-1 truncate font-semibold">{game.name}</span>
    {match ? (
      <span className="rounded-full bg-alert px-2 text-xs font-bold whitespace-nowrap text-warn-strong">
        wird ersetzt
      </span>
    ) : (
      <SavedAt game={game} on={false} />
    )}
  </button>
);

/** Load: one choice of a radio group, so the arrow keys move through the list. */
const GameChoice = ({
  game,
  group,
  checked,
  disabled,
  autoFocus,
  onChoose,
}: {
  game: LockerGame;
  group: string;
  checked: boolean;
  disabled: boolean;
  autoFocus: boolean;
  onChoose: () => void;
}) => (
  <label
    className={cn(
      ROW,
      rowTone(checked),
      !checked && 'hover:bg-secondary',
      'cursor-pointer has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-primary',
    )}
  >
    <input
      type="radio"
      name={group}
      checked={checked}
      onChange={onChoose}
      disabled={disabled}
      data-autofocus={autoFocus || undefined}
      className="sr-only"
    />
    <span
      className={cn(
        'grid size-4.5 flex-none place-items-center rounded-full border-2',
        checked ? 'border-primary' : 'border-[#b5b9c7]',
      )}
      aria-hidden
    >
      {checked && <span className="size-2 rounded-full bg-primary" />}
    </span>
    <span className="min-w-0 flex-1 truncate font-semibold">{game.name}</span>
    <SavedAt game={game} on={checked} />
  </label>
);
