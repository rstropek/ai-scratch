// Guards against excessive output. max_tokens (chat.ts) bounds the cost of one call but is far above any
// real answer, since thinking and tool inputs (scripts, SVG drawings) need room; cutting a tool call
// short would only produce a tool error. These guards stop what a kid could provoke without leaving a
// broken answer: a runaway text answer is cut cleanly, and a turn that keeps calling the model ends.
import type { UIMessageChunk } from 'ai';
import type { ChatMessage } from '../shared/chat-types.ts';

/** Visible text per model call. Real answers stay far below (longest measured: ~1,100 characters). */
export const MAX_ANSWER_CHARS = 3000;
/** Model calls per turn (one per /api/chat request). Real turns take 2–10. */
export const MAX_STEPS_PER_TURN = 25;

export const CUT_NOTE = ' … *(Ich höre hier auf, das wird zu lang.)*';
export const STEP_LIMIT_ANSWER =
  'Das war jetzt sehr viel auf einmal. Probier aus, was schon da ist, und sag mir, wie es weitergehen soll.';

/** Cuts at the last space before `room` so no word is split. */
const cut = (text: string, room: number): string => {
  const head = text.slice(0, Math.max(room, 0));
  const space = head.lastIndexOf(' ');
  return space > room - 40 ? head.slice(0, space) : head;
};

/**
 * Passes the UI stream through until the visible text exceeds `maxChars`, then ends the text with a
 * note, closes the message properly (finish-step, finish) and calls `onCut`, which aborts the model call.
 */
export const capAnswerText = (
  stream: ReadableStream<UIMessageChunk>,
  onCut: () => void,
  maxChars = MAX_ANSWER_CHARS,
): ReadableStream<UIMessageChunk> => {
  let chars = 0;
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type === 'text-delta' && chars + chunk.delta.length > maxChars) {
          controller.enqueue({ ...chunk, delta: cut(chunk.delta, maxChars - chars) + CUT_NOTE });
          controller.enqueue({ type: 'text-end', id: chunk.id });
          controller.enqueue({ type: 'finish-step' });
          controller.enqueue({ type: 'finish', finishReason: 'length' });
          controller.terminate();
          onCut();
          return;
        }
        if (chunk.type === 'text-delta') chars += chunk.delta.length;
        controller.enqueue(chunk);
      },
    }),
  );
};

/** Model calls so far in the current turn: the steps of the assistant messages after the last user message. */
export const stepsInTurn = (messages: ChatMessage[]): number =>
  messages
    .slice(messages.findLastIndex((m) => m.role === 'user') + 1)
    .reduce((n, m) => n + m.parts.filter((p) => p.type === 'step-start').length, 0);
