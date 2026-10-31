// Mocks /api/chat at the network layer: each request of a turn gets the next scripted model step,
// encoded by the AI SDK itself (createUIMessageStream), so the wire format always matches the SDK.
import type { Page, Request } from '@playwright/test';
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessageChunk } from 'ai';
import type { ChatMetadata } from '../../src/shared/chat-types.ts';

type Call = { name: string; input: unknown };
export type Step = { toolCalls: Call[] } | { text: string; metadata?: ChatMetadata };

export const toolCall = (name: string, input: unknown = {}): Step => ({ toolCalls: [{ name, input }] });
/** Several tool calls in one model step, as the model often sends them. */
export const toolCalls = (...calls: [name: string, input: unknown][]): Step => ({
  toolCalls: calls.map(([name, input]) => ({ name, input })),
});
/** A text answer; `metadata` goes on its finish chunk (e.g. the context the turn measured). */
export const answer = (text: string, metadata?: ChatMetadata): Step => ({ text, metadata });

let ids = 0;
const chunksFor = (step: Step, messageId: string): UIMessageChunk[] => {
  const id = `mock-${ids++}`;
  const body: UIMessageChunk[] =
    'text' in step
      ? [
          { type: 'text-start', id },
          { type: 'text-delta', id, delta: step.text },
          { type: 'text-end', id },
        ]
      : step.toolCalls.map(
          ({ name, input }, i): UIMessageChunk => ({
            type: 'tool-input-available',
            toolCallId: `${id}-${i}`,
            toolName: name,
            input,
          }),
        );
  const metadata = 'metadata' in step && step.metadata ? { messageMetadata: step.metadata } : {};
  return [
    { type: 'start', messageId },
    { type: 'start-step' },
    ...body,
    { type: 'finish-step' },
    { type: 'finish', ...metadata },
  ];
};

const encode = async (step: Step, messageId: string) => {
  const response = createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        for (const chunk of chunksFor(step, messageId)) writer.write(chunk);
      },
    }),
  });
  return { headers: Object.fromEntries(response.headers), body: await response.text() };
};

/** Answers the chat requests with the given steps in order; returns the request bodies sent. */
export const mockChat = async (page: Page, steps: Step[]): Promise<Record<string, unknown>[]> => {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/chat', async (route) => {
    const request: Request = route.request();
    const body = request.postDataJSON() as { messages: { id: string; role: string }[] };
    requests.push(body);
    // like the real server: a request after tool results continues the last assistant message
    const last = body.messages.at(-1);
    const messageId = last?.role === 'assistant' ? last.id : `mock-msg-${ids++}`;
    const step = steps[requests.length - 1];
    if (!step) {
      await route.fulfill({ status: 500, json: { error: 'no more mock steps' } });
      return;
    }
    const response = await encode(step, messageId);
    await route.fulfill({ status: 200, headers: response.headers, body: response.body });
  });
  return requests;
};
