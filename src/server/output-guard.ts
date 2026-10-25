// Guards against excessive output. max_tokens (chat.ts) bounds the cost of one call but is far above any
// real answer, since thinking and tool inputs (scripts, SVG drawings) need room; a tool call cut short
// by it becomes a tool error (closeCutToolCalls). These guards stop what a kid could provoke without
// leaving a broken answer: a runaway text answer is cut cleanly, and a turn that keeps calling the model ends.
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

/** What the model reads when max_tokens cut its tool call short (see closeCutToolCalls). */
export const CUT_TOOL_CALL_ERROR =
  'Not run: your answer hit the output token limit before this tool call was complete. Think less, and keep each tool call small: split long scripts into several add_scripts calls (one script each).';

/**
 * A model call that hits max_tokens in the middle of a tool call ends with that tool's input still
 * streaming: the browser never runs it, and the chat would wait for it forever. This closes every open
 * tool input with a tool-input-error before the step ends; the chat then sends the error to the model
 * with the next request, like any failed tool call. `onCut` counts it.
 */
export const closeCutToolCalls = (
  stream: ReadableStream<UIMessageChunk>,
  onCut: () => void,
): ReadableStream<UIMessageChunk> => {
  const open = new Map<string, string>();
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type === 'tool-input-start') open.set(chunk.toolCallId, chunk.toolName);
        if (chunk.type === 'tool-input-available' || chunk.type === 'tool-input-error') open.delete(chunk.toolCallId);
        if ((chunk.type === 'finish-step' || chunk.type === 'finish') && open.size) {
          for (const [toolCallId, toolName] of open)
            controller.enqueue({
              type: 'tool-input-error',
              toolCallId,
              toolName,
              input: {},
              errorText: CUT_TOOL_CALL_ERROR,
            });
          open.clear();
          onCut();
        }
        controller.enqueue(chunk);
      },
    }),
  );
};

/** Whether a UI stream chunk shows the model said or did something (text or a tool call). */
const says = (chunk: UIMessageChunk) => chunk.type === 'text-delta' || chunk.type === 'tool-input-start';

/** The effort of the one retry after a call that only thought (retryThinkingCut). */
export const RETRY_EFFORT = 'low';

/**
 * Haiku sometimes spends all of max_tokens on thinking (Minesweeper logic: 16k thinking tokens, ~70 s,
 * five turns of one game) and ends without text or tool calls. Such a call is asked once more, at
 * RETRY_EFFORT: `retry` streams that call, and its chunks continue this answer as a further step.
 * `onCut` counts each cut.
 */
export const retryThinkingCut = (
  stream: ReadableStream<UIMessageChunk>,
  retry: () => ReadableStream<UIMessageChunk>,
  onCut: () => void,
): ReadableStream<UIMessageChunk> => {
  let said = false;
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      async transform(chunk, controller) {
        if (says(chunk)) said = true;
        if (chunk.type !== 'finish' || chunk.finishReason !== 'length' || said) {
          controller.enqueue(chunk);
          return;
        }
        onCut();
        const reader = retry().getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          if (value.type !== 'start') controller.enqueue(value);
        }
      },
    }),
  );
};

/** Shown when the retry thought until max_tokens too; the model reads it next turn too. */
export const THOUGHT_TOO_LONG =
  'Puh, darüber habe ich so lange nachgedacht, dass ich nicht fertig geworden bin. Lass uns das in kleineren Schritten bauen: Was soll als Erstes klappen?';

/**
 * The last resort after retryThinkingCut: a call that thought until max_tokens and said nothing gets a
 * short note as a step of its own before the message ends, so the kid never gets an empty answer.
 * `onCut` counts it.
 */
export const noteThinkingCut = (
  stream: ReadableStream<UIMessageChunk>,
  onCut: () => void,
): ReadableStream<UIMessageChunk> => {
  let said = false;
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (says(chunk)) said = true;
        if (chunk.type === 'finish' && chunk.finishReason === 'length' && !said) {
          const id = 'thought-too-long';
          controller.enqueue({ type: 'start-step' });
          controller.enqueue({ type: 'text-start', id });
          controller.enqueue({ type: 'text-delta', id, delta: THOUGHT_TOO_LONG });
          controller.enqueue({ type: 'text-end', id });
          controller.enqueue({ type: 'finish-step' });
          onCut();
        }
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
