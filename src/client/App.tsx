// Layout: chat on the left, the unmodified Scratch editor in a same-origin iframe on the right
// (the iframe isolates Scratch's global CSS from Tailwind and lets the editor mount exactly once).
// The chat is resizable (splitter) and foldable into a slim rail; it stays mounted while folded,
// so a running turn keeps going. Until the school's access code is in, the chat shows the access gate.
import { MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createProjectBackups } from '../shared/scratch/project-backup.ts';
import { checkCode, forgetCode, storeCode, storedCode, takeLinkCode } from './access.ts';
import { AccessGate } from './chat/AccessGate.tsx';
import { ChatPanel } from './chat/ChatPanel.tsx';
import { OFFLINE } from './chat/errors.ts';
import { Splitter } from './components/Splitter.tsx';
import { cn } from './lib/utils.ts';
import { createToolRunner } from './scratch/tool-runner.ts';
import { useScratchBridge } from './scratch/use-scratch-bridge.ts';
import { CHAT_WIDTH, maxChatWidth, useUiPrefs } from './ui-prefs.ts';

const sessionId = crypto.randomUUID();

// read once per page load: the link's code wins over the remembered one
const linkCode = takeLinkCode();
const startCode = linkCode ?? storedCode();

type CodeSource = 'link' | 'stored' | 'typed';
type Access =
  | { state: 'open'; code: string }
  | { state: 'checking'; code: string }
  | { state: 'gate'; error?: string; code?: string };

const WRONG: Record<CodeSource, string> = {
  typed: 'Dieser Code stimmt nicht. Schau genau nach oder frag deine Lehrerin oder deinen Lehrer.',
  link: 'Der Code im Link stimmt nicht. Gib den Code ein, den du von deiner Lehrerin oder deinem Lehrer bekommen hast.',
  stored: 'Dein Code gilt nicht mehr. Frag deine Lehrerin oder deinen Lehrer nach dem richtigen Code.',
};

/** The access code: checked once on start (link or remembered), then whenever the kid types one in. */
const useAccess = () => {
  const [access, setAccess] = useState<Access>(() =>
    startCode ? { state: 'checking', code: startCode } : { state: 'gate' },
  );
  const unlock = useCallback(async (code: string, source: CodeSource) => {
    setAccess({ state: 'checking', code });
    const result = await checkCode(code);
    if (result === 'ok') {
      storeCode(code);
      setAccess({ state: 'open', code });
      return;
    }
    // a remembered code stays remembered when only the connection failed (also when the kid retries it)
    if (result === 'wrong' && code === storedCode()) forgetCode();
    setAccess(
      result === 'wrong'
        ? { state: 'gate', error: WRONG[source], code: source === 'typed' ? code : undefined }
        : { state: 'gate', error: OFFLINE, code },
    );
  }, []);
  const started = useRef(false);
  useEffect(() => {
    // once, also under StrictMode's double effects
    if (started.current || !startCode) return;
    started.current = true;
    void unlock(startCode, linkCode ? 'link' : 'stored');
  }, [unlock]);
  /** the server refused the code later on (removed from its list) */
  const deny = useCallback(() => {
    forgetCode();
    setAccess({ state: 'gate', error: WRONG.stored });
  }, []);
  return { access, unlock, deny };
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
  const { access, unlock, deny } = useAccess();
  const [dragging, setDragging] = useState(false);
  const maxWidth = maxChatWidth(useViewportWidth());
  const chatWidth = Math.min(prefs.chatWidth, maxWidth);

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
            runTool={runTool}
            backups={backups}
            prefs={prefs}
            onPrefs={updatePrefs}
            onFold={() => updatePrefs({ folded: true })}
            onBusyChange={setBusy}
            onAccessDenied={deny}
          />
        ) : (
          <AccessGate
            // a fresh field after each check that went wrong
            key={access.state === 'gate' ? (access.error ?? '') : 'checking'}
            checking={access.state === 'checking'}
            error={access.state === 'gate' ? access.error : undefined}
            initialCode={access.code}
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
    </div>
  );
};
