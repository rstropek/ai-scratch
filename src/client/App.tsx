// Layout: chat on the left, the unmodified Scratch editor in a same-origin iframe on the right
// (the iframe isolates Scratch's global CSS from Tailwind and lets the editor mount exactly once).
// The chat is resizable (splitter) and foldable into a slim rail; it stays mounted while folded,
// so a running turn keeps going. Until a school's access code or a parent's OpenRouter key is in, the chat
// shows the access gate.
import { MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isOpenRouterKey, type KeyProblem } from '../shared/access.ts';
import type { LockerAction } from '../shared/locker.ts';
import { createProjectBackups } from '../shared/scratch/project-backup.ts';
import {
  acceptTerms,
  type CodeCheck,
  checkCode,
  forgetCode,
  storeCode,
  storedCode,
  takeLinkCode,
  termsAccepted,
} from './access.ts';
import { AccessGate, type GatePath } from './chat/AccessGate.tsx';
import { ChatPanel } from './chat/ChatPanel.tsx';
import { OFFLINE } from './chat/errors.ts';
import { Splitter } from './components/Splitter.tsx';
import { createHeartsStore } from './hearts.ts';
import { createAsk } from './ki-ask.ts';
import { cn } from './lib/utils.ts';
import { LockerDialog } from './locker/LockerDialog.tsx';
import { createLockerApi, createLockerProject, openLockerPage, storedLockerCode } from './locker/locker.ts';
import { createToolRunner } from './scratch/tool-runner.ts';
import { useScratchBridge } from './scratch/use-scratch-bridge.ts';
import { CHAT_WIDTH, maxChatWidth, useUiPrefs } from './ui-prefs.ts';

const sessionId = crypto.randomUUID();
/** KI-Energie for this page load, used by the chat and the "frage KI" block */
const hearts = createHeartsStore();

// read once per page load: the link's code wins over the remembered one. A remembered key needs the
// parents' consent to the current terms; without it the gate asks them again, with the key filled in.
const linkCode = takeLinkCode();
const remembered = storedCode();
const rememberedKeyNeedsTerms = remembered !== undefined && isOpenRouterKey(remembered) && !termsAccepted();
const startCode = linkCode ?? (rememberedKeyNeedsTerms ? undefined : remembered);

type CodeSource = 'link' | 'stored' | 'typed';
type Access =
  | { state: 'open'; code: string }
  | { state: 'checking'; code: string }
  | { state: 'gate'; error?: string; code?: string; path?: GatePath; agreed?: boolean };

const WRONG: Record<CodeSource, string> = {
  typed: 'Dieser Code stimmt nicht. Schau genau nach oder frag deine Lehrerin oder deinen Lehrer.',
  link: 'Der Code im Link stimmt nicht. Gib den Code ein, den du von deiner Lehrerin oder deinem Lehrer bekommen hast.',
  stored: 'Dein Code gilt nicht mehr. Frag deine Lehrerin oder deinen Lehrer nach dem richtigen Code.',
};

/**
 * For the parents, who enter the key. The server's refusals carry texts for the kid (chat, "frage KI"); the
 * gate reads only their reason. `unknown`: a typed key OpenRouter doesn't know.
 */
const KEY_ERROR: Record<KeyProblem | 'stored', string> = {
  unknown:
    'OpenRouter kennt diesen Schlüssel nicht. Prüfen Sie, ob er vollständig kopiert ist (er beginnt mit sk-or-), oder legen Sie einen neuen an.',
  stored: 'Der gespeicherte OpenRouter-Schlüssel gilt nicht mehr. Tragen Sie bitte einen gültigen ein.',
  'no-limit':
    'Dieser Schlüssel hat kein Ausgabelimit. Stellen Sie bei OpenRouter unter „Keys“ ein Limit ein (zum Beispiel 5 $) und versuchen Sie es nochmal.',
  empty:
    'Das Guthaben ist aufgebraucht: entweder das Limit dieses Schlüssels oder das Guthaben Ihres OpenRouter-Kontos. Erhöhen Sie es bei OpenRouter und versuchen Sie es nochmal.',
  down: 'OpenRouter antwortet gerade nicht. Versuchen Sie es in einer Minute nochmal.',
};

const errorText = (result: Exclude<CodeCheck, 'ok'>, source: CodeSource, key: boolean): string => {
  if (result === 'offline') return OFFLINE;
  if (!key) return WRONG[source];
  if (result === 'wrong') return KEY_ERROR[source === 'typed' ? 'unknown' : 'stored'];
  return KEY_ERROR[result];
};

/** The access code or key: checked once on start (link or remembered), then whenever one is typed in. */
const useAccess = () => {
  const [access, setAccess] = useState<Access>(() =>
    startCode
      ? { state: 'checking', code: startCode }
      : rememberedKeyNeedsTerms
        ? { state: 'gate', code: remembered, path: 'key' }
        : { state: 'gate' },
  );
  const openCode = useRef<string>(undefined);
  const unlock = useCallback(async (code: string, source: CodeSource) => {
    const key = isOpenRouterKey(code);
    setAccess({ state: 'checking', code });
    const result = await checkCode(code);
    if (result === 'ok') {
      storeCode(code);
      // the gate only sends a key with the box ticked
      if (key) acceptTerms();
      openCode.current = code;
      setAccess({ state: 'open', code });
      return;
    }
    // a remembered code stays remembered when only the connection failed (also when the kid retries it)
    if (result === 'wrong' && code === storedCode()) forgetCode();
    setAccess({
      state: 'gate',
      error: errorText(result, source, key),
      code: result === 'wrong' && source !== 'typed' ? undefined : code,
      path: key ? 'key' : 'school',
      agreed: key && (source === 'typed' || termsAccepted()),
    });
  }, []);
  const started = useRef(false);
  useEffect(() => {
    // once, also under StrictMode's double effects
    if (started.current || !startCode) return;
    started.current = true;
    void unlock(startCode, linkCode ? 'link' : 'stored');
  }, [unlock]);
  /** the server refused the code later on (removed from its list), or OpenRouter the key */
  const deny = useCallback(() => {
    const key = isOpenRouterKey(openCode.current ?? '');
    forgetCode();
    setAccess({ state: 'gate', error: key ? KEY_ERROR.stored : WRONG.stored, path: key ? 'key' : 'school' });
  }, []);
  /** "Schlüssel vergessen": a key on a shared computer */
  const forgetKey = useCallback(() => {
    forgetCode();
    openCode.current = undefined;
    setAccess({ state: 'gate' });
  }, []);
  return { access, unlock, deny, forgetKey };
};

const useViewportWidth = () => {
  const [width, setWidth] = useState(innerWidth);
  useEffect(() => {
    const update = () => setWidth(innerWidth);
    addEventListener('resize', update);
    return () => removeEventListener('resize', update);
  }, []);
  return width;
};

/** The folded chat: a slim strip whose top continues Scratch's purple menu bar. */
const ChatRail = ({ busy, onOpen }: { busy: boolean; onOpen: () => void }) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label="Chat öffnen"
    title="Chat öffnen"
    className="group flex w-12 flex-none flex-col items-center border-r bg-secondary text-foreground outline-none hover:bg-accent focus-visible:bg-accent"
  >
    <span className="grid h-12 w-full flex-none place-items-center bg-primary text-primary-foreground group-hover:bg-primary-hover">
      <MessageCircle className="size-6" aria-hidden />
    </span>
    <span className="mt-4 text-sm font-bold [writing-mode:vertical-rl]">KI-Helfer</span>
    {busy && (
      <span
        className="mt-4 size-2.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
        data-testid="rail-busy"
      >
        <span className="sr-only">Die KI arbeitet noch</span>
      </span>
    )}
  </button>
);

export const App = () => {
  const iframe = useRef<HTMLIFrameElement>(null);
  const bridge = useScratchBridge(iframe);
  const runTool = useMemo(() => (bridge ? createToolRunner(bridge) : undefined), [bridge]);
  const backups = useMemo(() => (bridge ? createProjectBackups(bridge.vm) : undefined), [bridge]);
  const [prefs, updatePrefs] = useUiPrefs();
  const [busy, setBusy] = useState(false);
  const { access, unlock, deny, forgetKey } = useAccess();
  const [dragging, setDragging] = useState(false);
  const [lockerAction, setLockerAction] = useState<LockerAction>();
  const [projectLoads, setProjectLoads] = useState(0);
  const maxWidth = maxChatWidth(useViewportWidth());
  const chatWidth = Math.min(prefs.chatWidth, maxWidth);

  // the "frage KI" block in the kid's program asks with the same code, session and hearts as the chat
  const openCode = access.state === 'open' ? access.code : undefined;
  useEffect(() => {
    if (!bridge || !openCode) return;
    bridge.ask = createAsk({ accessCode: openCode, sessionId, hearts, onAccessDenied: deny });
    return () => {
      delete bridge.ask;
    };
  }, [bridge, openCode, deny]);

  // the Locker entries in Scratch's Datei menu open the Locker dialog (src/editor/locker-menu.ts)
  const lockerProject = useMemo(
    () => (bridge ? createLockerProject(bridge, () => setProjectLoads((n) => n + 1)) : undefined),
    [bridge],
  );
  const lockerApi = useMemo(
    () => (openCode ? createLockerApi({ accessCode: openCode, onAccessDenied: deny }) : undefined),
    [openCode, deny],
  );
  useEffect(() => {
    if (!bridge) return;
    bridge.openLocker = (action) => {
      // with the code from this tab, the Locker's page opens at once (still inside the menu click)
      const code = storedLockerCode();
      if (action === 'open' && code && openLockerPage(code)) return;
      setLockerAction(action);
    };
    return () => {
      delete bridge.openLocker;
    };
  }, [bridge]);

  // Warn before closing/reloading the tab: the Scratch project only lives in this tab.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, []);

  return (
    <div className={cn('flex h-full', dragging && 'cursor-col-resize')}>
      {prefs.folded && <ChatRail busy={busy} onOpen={() => updatePrefs({ folded: false })} />}
      <div className={cn('h-full min-w-0 flex-none', prefs.folded && 'hidden')} style={{ width: chatWidth }}>
        {access.state === 'open' ? (
          <ChatPanel
            accessCode={access.code}
            sessionId={sessionId}
            hearts={hearts}
            runTool={runTool}
            backups={backups}
            prefs={prefs}
            onPrefs={updatePrefs}
            onFold={() => updatePrefs({ folded: true })}
            onBusyChange={setBusy}
            onAccessDenied={deny}
            onForgetKey={isOpenRouterKey(access.code) ? forgetKey : undefined}
            projectLoads={projectLoads}
          />
        ) : (
          <AccessGate
            // a fresh field after each check that went wrong
            key={access.state === 'gate' ? (access.error ?? '') : 'checking'}
            checking={access.state === 'checking'}
            error={access.state === 'gate' ? access.error : undefined}
            initialCode={access.code}
            initialPath={access.state === 'gate' ? access.path : undefined}
            initialAgreed={access.state === 'checking' || (access.state === 'gate' && access.agreed)}
            onCode={(code) => void unlock(code, 'typed')}
            fontSize={prefs.fontSize}
            onFontSize={(fontSize) => updatePrefs({ fontSize })}
            onFold={() => updatePrefs({ folded: true })}
          />
        )}
      </div>
      {!prefs.folded && (
        <Splitter
          axis="x"
          value={chatWidth}
          min={CHAT_WIDTH.min}
          max={maxWidth}
          onChange={(width) => updatePrefs({ chatWidth: width })}
          onReset={() => updatePrefs({ chatWidth: CHAT_WIDTH.default })}
          onDragChange={setDragging}
          label="Chat-Breite ändern"
          // the top 3rem continue the purple menu bar, the rest is the panel border
          className="bg-[linear-gradient(to_bottom,var(--primary)_3rem,var(--accent)_3rem)]"
        />
      )}
      <iframe
        ref={iframe}
        src="/editor.html"
        title="Scratch"
        className={cn('h-full min-w-0 flex-1 border-0', dragging && 'pointer-events-none')}
      />
      {lockerAction && lockerProject && (
        <LockerDialog
          action={lockerAction}
          api={lockerApi}
          project={lockerProject}
          aiBusy={busy}
          onClose={() => setLockerAction(undefined)}
        />
      )}
    </div>
  );
};
