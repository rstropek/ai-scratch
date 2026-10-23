// One chat message: text, a hint while the model thinks, a status line per tool call, token usage.
import { type DynamicToolUIPart, getToolName, isToolUIPart, type ToolUIPart } from 'ai';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../../shared/chat-types.ts';

// Arguments of these tools are long (scripts, SVG): show only the tool name.
const LONG_ARGS = new Set(['add_scripts', 'draw_sprite', 'draw_costume']);

const ToolLine = ({ part }: { part: ToolUIPart | DynamicToolUIPart }) => {
  const name = getToolName(part);
  const args = part.input && !LONG_ARGS.has(name) ? JSON.stringify(part.input) : '';
  const failed = part.state === 'output-error';
  return (
    <div
      className={cn('text-xs [overflow-wrap:anywhere]', failed ? 'text-destructive' : 'text-muted-foreground')}
      data-testid="tool-call"
    >
      🔧 {name}
      <span className="opacity-60">{args}</span>{' '}
      {part.state === 'output-available' ? '✓' : failed ? `✗ ${part.errorText}` : '…'}
    </div>
  );
};

export const MessageView = ({ message }: { message: ChatMessage }) => {
  const fromUser = message.role === 'user';
  const usage = message.metadata?.usage;
  return (
    <div className={cn('my-2 flex flex-col gap-1', fromUser ? 'items-end' : 'items-start')} data-role={message.role}>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`;
        if (part.type === 'text') {
          return (
            <div
              key={key}
              className={cn(
                'max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm',
                fromUser ? 'bg-blue-100' : 'bg-muted',
              )}
              data-testid={fromUser ? 'user-text' : 'assistant-text'}
            >
              {part.text}
            </div>
          );
        }
        if (part.type === 'reasoning') {
          return (
            <div key={key} className="text-[11px] text-muted-foreground">
              💭 denkt nach…
            </div>
          );
        }
        if (isToolUIPart(part)) return <ToolLine key={key} part={part} />;
        return null;
      })}
      {usage && (
        <div className="text-[10px] text-muted-foreground/70">
          {usage.inputTokens} in ({usage.inputTokenDetails?.cacheReadTokens ?? 0} cached) / {usage.outputTokens} out
        </div>
      )}
    </div>
  );
};
