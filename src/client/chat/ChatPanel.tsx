// The chat beside the editor. Tools run in the browser on the live VM (onToolCall); the next request of
// the turn is sent automatically once all tool results are in.
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { Hourglass, SendHorizontal, Square } from 'lucide-react';
import { type FormEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Splitter } from '@/components/Splitter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ACCESS_CODE_HEADER, type ChatMessage, SESSION_HEADER } from '../../shared/chat-types.ts';
import {
  type Bucket,
  CONTEXT_LIMIT,
  contextOf,
  fullBucket,
  HEARTS,
  hasHistory,
  heartsLeft,
  isAdminCode,
  memoryFull,
  nextHeartIn,
  refill,
  take,
} from '../../shared/energy.ts';
import type { ToolRunner } from '../scratch/tool-runner.ts';
import { INPUT_HEIGHT, type UiPrefs } from '../ui-prefs.ts';
import { ChatTopBar } from './ChatTopBar.tsx';
import { EnergyBar, MemoryActions, type MemoryActionsProps } from './EnergyBar.tsx';
import { kidFriendlyError } from './errors.ts';
import { Bubble, MessageView, Thinking } from './MessageView.tsx';

export interface ChatPanelProps {
  accessCode: string;
  sessionId: string;
  /** undefined while Scratch is still loading */
  runTool: ToolRunner | undefined;
  prefs: UiPrefs;
  onPrefs: (change: Partial<UiPrefs>) => void;
  onFold: () => void;
  /** a turn is in progress (the folded rail shows it) */
  onBusyChange: (busy: boolean) => void;
  /** the server no longer accepts the access code (401) */
  onAccessDenied: () => void;
}

const WELCOME =
  'Hallo! Ich bin dein KI-Helfer. Sag mir, was ich in deinem Scratch-Projekt bauen soll – oder frag mich, wo du etwas findest.';

// the send/stop button: scales with the chat font (the row is 0.875em), with a clearer focus ring
const SEND_BUTTON = 'h-auto py-1.5 text-[length:inherit] focus-visible:ring-ring [&_svg]:size-[1em]';

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded border bg-secondary px-1 shadow-[0_1px_0_var(--border)] font-sans text-[0.9em]">
    {children}
  </kbd>
);

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** From this share of the limit on, a hint above the input suggests freeing the memory. */
const MEMORY_HINT = 0.85;

/** The wait the server asked for when it refused a message for lack of hearts (429 body). */
const retryInMs = (error: Error | undefined): number | undefined => {
  try {
    const body: unknown = JSON.parse(error?.message ?? '');
    return body && typeof body === 'object' && 'retryInMs' in body && typeof body.retryInMs === 'number'
      ? body.retryInMs
      : undefined;
  } catch {
    return undefined;
  }
};

/** The current time, ticking while `active` (hearts refilling). */
const useNow = (active: boolean, everyMs = 500) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [active, everyMs]);
  return now;
};

export const ChatPanel = ({
  accessCode,
  sessionId,
  runTool,
  prefs,
  onPrefs,
  onFold,
  onBusyChange,
  onAccessDenied,
}: ChatPanelProps) => {
  const [input, setInput] = useState('');
  const runToolRef = useRef(runTool);
  runToolRef.current = runTool;
  const deniedRef = useRef(onAccessDenied);
  deniedRef.current = onAccessDenied;
  const bottom = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelHeight = useElementHeight(panel);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: '/api/chat',
        headers: { [ACCESS_CODE_HEADER]: accessCode, [SESSION_HEADER]: sessionId },
        fetch: async (url, init) => {
          const res = await fetch(url, init);
          if (res.status === 401) deniedRef.current();
          return res;
        },
      }),
    [accessCode, sessionId],
  );
  const { messages, setMessages, sendMessage, addToolOutput, status, error, clearError, stop } = useChat<ChatMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      const { toolName, toolCallId } = toolCall;
      const run = runToolRef.current;
      const result = run ? run(toolName, toolCall.input) : Promise.reject(new Error('Scratch is not ready yet'));
      // don't await addToolOutput here (deadlock warning in the AI SDK docs)
      result.then(
        (output) => addToolOutput({ tool: toolName, toolCallId, output }),
        (e: unknown) => addToolOutput({ tool: toolName, toolCallId, state: 'output-error', errorText: errorText(e) }),
      );
    },
  });

  const lastMessage = messages.at(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the last message changes
  useEffect(() => {
    // block body: newer browsers return a Promise here, which React would take for a cleanup function
    void bottom.current?.scrollIntoView({ block: 'end' });
  }, [lastMessage]);

  // KI-Energie (src/shared/energy.ts): the server enforces the same rules; this keeps the kid from
  // running into its refusals
  const admin = isAdminCode(accessCode);
  const [bucket, setBucket] = useState<Bucket>(() => fullBucket(Date.now()));
  const now = useNow(!admin && refill(bucket, Date.now()).hearts < HEARTS.max);
  const hearts = admin ? HEARTS.max : heartsLeft(bucket, now);
  const waitMs = nextHeartIn(bucket, now);
  // if the server refused a message for lack of hearts anyway, its clock wins
  useEffect(() => {
    const wait = retryInMs(error);
    if (wait !== undefined) setBucket({ hearts: Math.max(0, 1 - wait / HEARTS.refillMs), at: Date.now() });
  }, [error]);

  // Gedächtnis: measured by every turn; after freeing it the gauge shows an estimate until the next turn
  const baseContext = useRef<number | undefined>(undefined);
  const measured = contextOf(messages);
  if (baseContext.current === undefined && measured !== undefined) baseContext.current = measured;
  const [clearedContext, setClearedContext] = useState<number | undefined>(undefined);
  const context = measured ?? clearedContext;
  const full = memoryFull(messages);
  const [compacting, setCompacting] = useState(false);
  const [compactError, setCompactError] = useState<string | undefined>(undefined);

  const ready = runTool !== undefined;
  // Between two requests of a turn the browser runs the tools and useChat reports "ready";
  // the turn is still going on, so the kid must not send a new message yet.
  const toolsRunning =
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some((p) => isToolUIPart(p) && (p.state === 'input-streaming' || p.state === 'input-available'));
  const busy = status === 'submitted' || status === 'streaming' || toolsRunning;
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const canSend = ready && !busy && !compacting && !full && hearts > 0;
  const sendText = async (text: string) => {
    if (!text.trim() || !canSend) return;
    if (!admin) setBucket((b) => take(b, Date.now()) ?? b);
    setCompactError(undefined);
    // project snapshot frozen into this turn's user message => identical prefix for every step of the turn
    const project = JSON.stringify(await runTool('get_project', {}));
    await sendMessage({ text, metadata: { project } });
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSend || !input.trim()) return;
    const text = input;
    setInput('');
    void sendText(text);
  };

  const compact = async () => {
    setCompacting(true);
    setCompactError(undefined);
    try {
      const res = await fetch('/api/compact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [ACCESS_CODE_HEADER]: accessCode, [SESSION_HEADER]: sessionId },
        body: JSON.stringify({ messages }),
      });
      if (res.status === 401) return onAccessDenied();
      const body = (await res.json().catch(() => ({}))) as { summary?: string; tokens?: number };
      if (!res.ok || !body.summary) throw new Error(JSON.stringify(body));
      clearError();
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          parts: [{ type: 'text', text: body.summary }],
          metadata: {
            summary: true,
            // estimate until the next turn measures it: the start of this session plus the summary
            ...(baseContext.current !== undefined ? { context: baseContext.current + (body.tokens ?? 0) } : {}),
          },
        },
      ]);
    } catch (e) {
      setCompactError(kidFriendlyError(e instanceof Error ? e : new Error(String(e))));
    } finally {
      setCompacting(false);
    }
  };
  const clear = () => {
    clearError();
    setCompactError(undefined);
    setMessages([]);
    setClearedContext(baseContext.current);
  };
  const memory: MemoryActionsProps = {
    canCompact: hasHistory(messages),
    canClear: messages.length > 0,
    busy: busy || compacting,
    compacting,
    onCompact: () => void compact(),
    onClear: clear,
  };
  const memoryHint = !full && memory.canCompact && (context ?? 0) >= CONTEXT_LIMIT * MEMORY_HINT;

  // the input may take at most half of the panel
  const maxInput = Math.max(INPUT_HEIGHT.min, Math.floor(panelHeight / 2));
  const inputHeight = Math.min(prefs.inputHeight, maxInput);

  return (
    <div ref={panel} className="flex h-full min-h-0 flex-col" style={{ fontSize: prefs.fontSize }}>
      <ChatTopBar
        fontSize={prefs.fontSize}
        onFontSize={(fontSize) => onPrefs({ fontSize })}
        showTools={prefs.showTools}
        onShowTools={(showTools) => onPrefs({ showTools })}
        onFold={onFold}
      />
      <EnergyBar
        hearts={hearts}
        refill={admin ? 1 : refill(bucket, now).hearts % 1}
        nextHeartInMs={waitMs}
        admin={admin}
        context={context}
        base={baseContext.current}
        memory={memory}
        actionsBelow={full || memoryHint}
      />
      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-3 py-1" data-testid="messages">
        {messages.length === 0 && (
          <div className="my-2.5 flex flex-col items-start">
            <Bubble from="assistant" testId="welcome">
              {WELCOME}
            </Bubble>
          </div>
        )}
        {messages.map((m) => (
          <MessageView key={m.id} message={m} showTools={prefs.showTools} />
        ))}
        {status === 'submitted' && (
          <div className="my-2.5">
            <Thinking />
          </div>
        )}
        {compactError && (
          <div
            className="my-2.5 rounded-lg border border-alert-border bg-alert px-3.5 py-2 text-[0.9em] text-foreground"
            role="alert"
          >
            {compactError}
          </div>
        )}
        {error && (
          <div
            className="my-2.5 rounded-lg border border-alert-border bg-alert px-3.5 py-2 text-[0.9em] text-foreground"
            role="alert"
          >
            {kidFriendlyError(error)}
          </div>
        )}
        <div ref={bottom} />
      </div>
      {(full || memoryHint) && (
        <div
          className={cn(
            'flex flex-none flex-col gap-2 border-t px-3 py-2 text-[0.9em]',
            full ? 'bg-alert' : 'bg-secondary',
          )}
          role={full ? 'alert' : 'status'}
          data-testid="memory-card"
        >
          <p className="font-bold">
            {full
              ? 'Mein Gedächtnis ist voll. Fasse unser Gespräch zusammen oder fang neu an. Dein Scratch-Projekt bleibt erhalten.'
              : 'Mein Gedächtnis ist bald voll. Fasse unser Gespräch zusammen, dann kann ich mir wieder mehr merken.'}
          </p>
          <MemoryActions {...memory} />
        </div>
      )}
      <Splitter
        axis="y"
        invert
        value={inputHeight}
        min={INPUT_HEIGHT.min}
        max={maxInput}
        onChange={(height) => onPrefs({ inputHeight: height })}
        onReset={() => onPrefs({ inputHeight: INPUT_HEIGHT.default })}
        label="Eingabefeld-Höhe ändern"
        className="border-t bg-secondary"
      />
      {/* Scratch's text-input look: one white box, purple border and halo on focus. The textarea takes the
          full width; the send button sits in a slim row below it, so a taller input wastes no space. */}
      <form onSubmit={onSubmit} className="flex-none bg-secondary px-3 pb-3">
        <div className="rounded-lg border bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:ring-4 focus-within:ring-ring has-[textarea:disabled]:opacity-60">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) onSubmit(e);
            }}
            disabled={!ready}
            aria-label="Nachricht an den KI-Helfer"
            style={{ height: inputHeight }}
            className="scrollbar-soft block w-full resize-none bg-transparent px-3 pt-2 outline-none [field-sizing:fixed] placeholder:text-muted-foreground disabled:cursor-not-allowed"
            placeholder={ready ? 'Was soll ich bauen?' : 'Scratch lädt…'}
          />
          <div className="@container flex items-center justify-end gap-2 pr-1.5 pb-1.5 pl-3 text-[0.875em]">
            {/* the hint only shows when it fits next to the button (narrow chat or large font: hidden) */}
            <span className="mr-auto hidden text-[0.85em] whitespace-nowrap text-muted-foreground @min-[18em]:inline">
              <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd>: neue Zeile
            </span>
            {busy ? (
              <Button type="button" variant="outline" size="sm" className={SEND_BUTTON} onClick={() => void stop()}>
                <Square aria-hidden className="fill-current" />
                Stopp
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                className={cn(SEND_BUTTON, 'font-bold')}
                disabled={!canSend || !input.trim()}
              >
                {hearts > 0 ? (
                  <>
                    Senden
                    <SendHorizontal aria-hidden />
                  </>
                ) : (
                  <>
                    <Hourglass aria-hidden />
                    Warte {Math.ceil(waitMs / 1000)} s
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

/** Tracks an element's height (0 until it is laid out, and in jsdom). */
const useElementHeight = (ref: RefObject<HTMLElement | null>) => {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry?.contentRect.height ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
};
