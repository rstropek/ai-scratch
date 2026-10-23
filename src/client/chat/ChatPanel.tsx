// The chat beside the editor. Tools run in the browser on the live VM (onToolCall); the next request of
// the turn is sent automatically once all tool results are in.
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ACCESS_CODE_HEADER, type ChatMessage, SESSION_HEADER } from '../../shared/chat-types.ts';
import type { ToolRunner } from '../scratch/tool-runner.ts';
import { kidFriendlyError } from './errors.ts';
import { MessageView } from './MessageView.tsx';

// Example prompts as buttons: handy for trying the assistant; the tutorial will replace them.
const EXAMPLES = [
  'Wo finde ich den Block "wiederhole fortlaufend"? Ich will ihn selbst einbauen!',
  'Bau: 3 mal 50 Schritte gehen und 1 Sekunde warten. Zeig mir dann, wo im Skript gewartet wird.',
  'Füge eine Fledermaus hinzu, die mit den Flügeln schlägt.',
  'Ich mache ein Weltraumspiel. Gib mir einen passenden Hintergrund.',
  'Zeichne mir einen grünen Drachen als neue Figur.',
  'Wo kann ich mein Projekt speichern?',
];

export interface ChatPanelProps {
  accessCode: string;
  sessionId: string;
  /** undefined while Scratch is still loading */
  runTool: ToolRunner | undefined;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const ChatPanel = ({ accessCode, sessionId, runTool }: ChatPanelProps) => {
  const [input, setInput] = useState('');
  const runToolRef = useRef(runTool);
  runToolRef.current = runTool;
  const bottom = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex min-h-0 flex-col border-r">
      <div className="flex-1 overflow-auto p-2" data-testid="messages">
        {messages.map((m) => (
          <MessageView key={m.id} message={m} />
        ))}
        {error && (
          <div className="my-2 rounded-md bg-red-50 px-3 py-2 text-sm text-destructive" role="alert">
            {kidFriendlyError(error)}
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="flex flex-wrap gap-1 px-2">
        {EXAMPLES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={!ready || busy}
            onClick={() => void sendText(t)}
            className="rounded-full border bg-muted/50 px-2 py-0.5 text-left text-[11px] hover:bg-muted disabled:opacity-50"
          >
            {t}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex items-end gap-2 p-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) onSubmit(e);
          }}
          disabled={!ready}
          rows={2}
          className="min-h-0 resize-none"
          placeholder={ready ? 'Was soll ich bauen?' : 'Scratch lädt…'}
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={() => void stop()}>
            Stopp
          </Button>
        ) : (
          <Button type="submit" disabled={!ready || !input.trim()}>
            Senden
          </Button>
        )}
      </form>
    </div>
  );
};
