// One chat message. Assistant text is Markdown in a Scratch "say" speech bubble, the kid's text
// plain in a light purple bubble. Tool calls and token usage only show when the tool toggle is on; otherwise a
// single friendly status line says that the AI is working on the project. An answer that changed the project
// ends with its undo button (undo.ts).
import { type DynamicToolUIPart, getToolName, isToolUIPart, type ToolUIPart } from 'ai';
import { Brain, Check, Hammer, LoaderCircle, NotebookPen, Undo2, Wrench, X } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../../shared/chat-types.ts';
import { renderMarkdown } from './markdown.ts';

// Arguments of these tools are long (scripts, SVG): show only the tool name.
const LONG_ARGS = new Set(['add_scripts', 'draw_sprite', 'draw_costume']);

type ToolPart = ToolUIPart | DynamicToolUIPart;
const isPending = (part: ToolPart) => part.state === 'input-streaming' || part.state === 'input-available';

/** A speech bubble: white with a tail like Scratch's "say" bubble (assistant), or light purple (kid). */
export const Bubble = ({
  from,
  children,
  testId,
  className,
}: {
  from: 'user' | 'assistant';
  children: ReactNode;
  testId?: string;
  className?: string;
}) => (
  <div
    className={cn(
      'relative max-w-[90%] rounded-2xl border px-3.5 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]',
      from === 'user'
        ? 'border-primary/35 bg-primary-light text-primary-ink'
        : 'mb-2 bg-white shadow-[0_1px_2px_hsla(0,0%,0%,0.08)]',
      className,
    )}
    data-testid={testId}
  >
    {children}
    {from === 'assistant' && <BubbleTail />}
  </div>
);

/**
 * The assistant bubble's tail. Drawn as SVG with the bubble's own 1px border colour: a rotated CSS square's
 * borders antialiase into a heavier line than the bubble's. Its white top row covers the bubble's bottom
 * border where the tail attaches.
 */
const BubbleTail = () => (
  <svg
    aria-hidden
    viewBox="0 0 14 8"
    className="absolute top-[calc(100%-1px)] left-5 h-2 w-3.5 overflow-visible drop-shadow-[0_1px_1px_hsla(0,0%,0%,0.08)]"
  >
    <path d="M0 0H14L7 7Z" fill="white" />
    <path d="M0 0.5L7 7L14 0.5" fill="none" stroke="var(--border)" strokeWidth="1" strokeLinejoin="round" />
  </svg>
);

/** The assistant's Markdown answer, styled by `.markdown` in index.css. */
const AssistantText = ({ text }: { text: string }) => {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return (
    <Bubble from="assistant" testId="assistant-text" className="markdown whitespace-normal">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: renderMarkdown sanitizes with DOMPurify */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </Bubble>
  );
};

/** The AI's summary that replaced the conversation before it ("Zusammenfassen"): what it still remembers. */
const SummaryCard = ({ text }: { text: string }) => {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return (
    <div
      className="markdown w-full rounded-xl border border-dashed border-primary/60 bg-white px-3.5 py-2"
      data-testid="summary"
    >
      <div className="mb-1 flex items-center gap-1.5 text-[0.85em] font-bold text-primary-ink [&_svg]:size-[1.1em]">
        <NotebookPen aria-hidden />
        Das habe ich mir von unserem Gespräch gemerkt:
      </div>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: renderMarkdown sanitizes with DOMPurify */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

/** A small grey line under the bubbles: thinking, working, tool calls, usage. */
const StatusLine = ({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}) => (
  <div
    className={cn(
      'flex items-center gap-1.5 text-[0.8em] text-muted-foreground [&_svg]:size-[1.15em] [&_svg]:flex-none',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const Thinking = () => (
  <StatusLine>
    <Brain aria-hidden />
    denkt nach…
  </StatusLine>
);

const ToolLine = ({ part }: { part: ToolPart }) => {
  const name = getToolName(part);
  const args = part.input && !LONG_ARGS.has(name) ? JSON.stringify(part.input) : '';
  const failed = part.state === 'output-error';
  return (
    <StatusLine
      className={cn('items-start [overflow-wrap:anywhere]', failed && 'text-destructive')}
      data-testid="tool-call"
    >
      <Wrench aria-hidden className="mt-[0.1em]" />
      <span>
        {name}
        <span className="opacity-70">{args}</span>{' '}
        {part.state === 'output-available' ? (
          <Check aria-label="fertig" className="inline align-[-0.15em]" />
        ) : failed ? (
          <>
            <X aria-label="Fehler" className="inline align-[-0.15em]" /> {part.errorText}
          </>
        ) : (
          <LoaderCircle aria-label="läuft" className="inline animate-spin align-[-0.15em]" />
        )}
      </span>
    </StatusLine>
  );
};

export interface UndoProps {
  onUndo: () => void;
  /** a turn is in progress */
  disabled: boolean;
}

const UndoButton = ({ onUndo, disabled }: UndoProps) => (
  <Button
    variant="ghost"
    size="xs"
    className="-ml-1.5 h-auto gap-1.5 py-0.5 text-[length:0.8em] font-normal text-muted-foreground hover:text-primary-ink"
    title="Macht dein Projekt wieder so, wie es vor dieser Antwort war"
    disabled={disabled}
    onClick={onUndo}
  >
    <Undo2 aria-hidden className="size-[1.15em]" />
    Rückgängig
  </Button>
);

export const MessageView = ({
  message,
  showTools,
  undo,
}: {
  message: ChatMessage;
  showTools: boolean;
  /** only for answers that changed the project and can still be undone */
  undo?: UndoProps;
}) => {
  if (message.metadata?.summary) {
    const text = message.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n');
    return (
      <div className="my-2.5" data-role="summary">
        <SummaryCard text={text} />
      </div>
    );
  }
  const fromUser = message.role === 'user';
  const usage = message.metadata?.usage;
  const working = !showTools && message.parts.some((p) => isToolUIPart(p) && isPending(p));
  return (
    <div
      className={cn('my-2.5 flex flex-col gap-1.5', fromUser ? 'items-end' : 'items-start')}
      data-role={message.role}
    >
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`;
        if (part.type === 'text') {
          if (!part.text) return null;
          // the kid's text stays plain: a typed * or # means just that
          return fromUser ? (
            <Bubble key={key} from="user" testId="user-text">
              {part.text}
            </Bubble>
          ) : (
            <AssistantText key={key} text={part.text} />
          );
        }
        // without the tool view, "thinking" only shows while it happens
        if (part.type === 'reasoning' && (showTools || part.state === 'streaming')) return <Thinking key={key} />;
        if (showTools && isToolUIPart(part)) return <ToolLine key={key} part={part} />;
        return null;
      })}
      {working && (
        <StatusLine className="animate-in fade-in-0 duration-200" data-testid="working">
          <Hammer aria-hidden className="animate-hammer text-primary" />
          baut an deinem Projekt…
        </StatusLine>
      )}
      {showTools && usage && (
        <StatusLine className="text-[0.7em]">
          {usage.inputTokens} in ({usage.inputTokenDetails?.cacheReadTokens ?? 0} cached) / {usage.outputTokens} out
        </StatusLine>
      )}
      {message.metadata?.undone ? (
        <StatusLine data-testid="undone">
          <Undo2 aria-hidden />
          rückgängig gemacht
        </StatusLine>
      ) : (
        undo && <UndoButton {...undo} />
      )}
    </div>
  );
};
