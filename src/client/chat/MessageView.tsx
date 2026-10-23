// One chat message. Assistant text is drawn as a Scratch "say" speech bubble, the kid's text as a
// light purple bubble. Tool calls and token usage only show when the tool toggle is on; otherwise a
// single friendly status line says that the AI is working on the project.
import { type DynamicToolUIPart, getToolName, isToolUIPart, type ToolUIPart } from 'ai';
import { Brain, Check, Hammer, LoaderCircle, Wrench, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../../shared/chat-types.ts';

// Arguments of these tools are long (scripts, SVG): show only the tool name.
const LONG_ARGS = new Set(['add_scripts', 'draw_sprite', 'draw_costume']);

type ToolPart = ToolUIPart | DynamicToolUIPart;
const isPending = (part: ToolPart) => part.state === 'input-streaming' || part.state === 'input-available';

/** A speech bubble: white with a tail like Scratch's "say" bubble (assistant), or light purple (kid). */
export const Bubble = ({
  from,
  children,
  testId,
}: {
  from: 'user' | 'assistant';
  children: ReactNode;
  testId?: string;
}) => (
  <div
    className={cn(
      'relative max-w-[90%] rounded-2xl border px-3.5 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]',
      from === 'user'
        ? 'border-primary/35 bg-primary-light'
        : 'mb-1.5 bg-white shadow-[0_1px_2px_hsla(0,0%,0%,0.08)] after:absolute after:-bottom-[6.5px] after:left-5 after:size-3 after:rotate-45 after:border-r after:border-b after:bg-white',
    )}
    data-testid={testId}
  >
    {children}
  </div>
);

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

export const MessageView = ({ message, showTools }: { message: ChatMessage; showTools: boolean }) => {
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
          return (
            <Bubble key={key} from={fromUser ? 'user' : 'assistant'} testId={fromUser ? 'user-text' : 'assistant-text'}>
              {part.text}
            </Bubble>
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
    </div>
  );
};
