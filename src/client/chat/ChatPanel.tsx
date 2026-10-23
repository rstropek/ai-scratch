// The chat beside the editor. Tools run in the browser on the live VM (onToolCall); the next request of
// the turn is sent automatically once all tool results are in.
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { type FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Splitter } from '@/components/Splitter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ACCESS_CODE_HEADER, type ChatMessage, SESSION_HEADER } from '../../shared/chat-types.ts';
import type { ToolRunner } from '../scratch/tool-runner.ts';
import { INPUT_HEIGHT, type UiPrefs } from '../ui-prefs.ts';
import { ChatTopBar } from './ChatTopBar.tsx';
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
}

const WELCOME =
  'Hallo! Ich bin dein KI-Helfer. Sag mir, was ich in deinem Scratch-Projekt bauen soll – oder frag mich, wo du etwas findest.';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const ChatPanel = ({ accessCode, sessionId, runTool, prefs, onPrefs, onFold, onBusyChange }: ChatPanelProps) => {
  const [input, setInput] = useState('');
  const runToolRef = useRef(runTool);
  runToolRef.current = runTool;
  const bottom = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelHeight = useElementHeight(panel);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: '/api/chat',
        headers: { [ACCESS_CODE_HEADER]: accessCode, [SESSION_HEADER]: sessionId },
      }),
    [accessCode, sessionId],
  );
  const { messages, sendMessage, addToolOutput, status, error, stop } = useChat<ChatMessage>({
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

  const ready = runTool !== undefined;
  // Between two requests of a turn the browser runs the tools and useChat reports "ready";
  // the turn is still going on, so the kid must not send a new message yet.
  const toolsRunning =
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some((p) => isToolUIPart(p) && (p.state === 'input-streaming' || p.state === 'input-available'));
  const busy = status === 'submitted' || status === 'streaming' || toolsRunning;
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const sendText = async (text: string) => {
    if (!text.trim() || busy || !runTool) return;
    // project snapshot frozen into this turn's user message => identical prefix for every step of the turn
    const project = JSON.stringify(await runTool('get_project', {}));
    await sendMessage({ text, metadata: { project } });
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    void sendText(text);
  };

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
      <form onSubmit={onSubmit} className="flex flex-none items-end gap-2 bg-secondary px-3 pb-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) onSubmit(e);
          }}
          disabled={!ready}
          style={{ height: inputHeight, fontSize: 'inherit' }}
          className="min-h-0 resize-none rounded-lg bg-white [field-sizing:fixed] placeholder:text-muted-foreground"
          placeholder={ready ? 'Was soll ich bauen?' : 'Scratch lädt…'}
        />
        {busy ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="text-[length:inherit]"
            onClick={() => void stop()}
          >
            Stopp
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            className="text-[length:inherit] font-bold"
            disabled={!ready || !input.trim()}
          >
            Senden
          </Button>
        )}
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
