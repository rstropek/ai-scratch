import { describe, expect, test } from 'vitest';
import type { ChatMessage } from '../shared/chat-types.ts';
import { buildModelInput, turnNumber } from './model-input.ts';

const user = (id: string, text: string, project?: string): ChatMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
  ...(project ? { metadata: { project } } : {}),
});

describe('buildModelInput', () => {
  const earlierAssistant: ChatMessage = {
    id: 'a1',
    role: 'assistant',
    parts: [
      { type: 'reasoning', text: 'secret thoughts' },
      {
        type: 'tool-add_scripts',
        toolCallId: 'c1',
        state: 'output-available',
        input: { sprite: 'Sprite1' },
        output: { ok: true },
      },
      { type: 'tool-green_flag', toolCallId: 'c2', state: 'output-error', input: {}, errorText: 'boom' },
      { type: 'text', text: 'Fertig!' },
    ],
  } as ChatMessage;
  const currentAssistant: ChatMessage = {
    id: 'a2',
    role: 'assistant',
    parts: [{ type: 'tool-get_project', toolCallId: 'c3', state: 'output-available', input: {}, output: {} }],
  } as ChatMessage;
  const messages = [
    user('u1', 'Bau was', '{"old":1}'),
    earlierAssistant,
    user('u2', 'Und jetzt?', '{"new":2}'),
    currentAssistant,
  ];

  test('earlier turns keep only text plus a note of the tools that ran', () => {
    const [u1, a1] = buildModelInput(messages);
    expect(u1?.parts).toEqual([{ type: 'text', text: 'Bau was' }]); // old snapshot dropped
    expect(a1?.parts).toEqual([
      { type: 'text', text: '[Ausgeführte Werkzeuge: add_scripts, green_flag (Fehler)]' },
      { type: 'text', text: 'Fertig!' },
    ]);
  });

  test('the current user message carries its project snapshot, the current turn stays verbatim', () => {
    const result = buildModelInput(messages);
    expect(result[2]?.parts[0]).toEqual({
      type: 'text',
      text: '<projekt>\n{"new":2}\n</projekt>\n(Das ist der aktuelle Projektstand, get_project ist nicht nötig.)',
    });
    expect(result[3]).toBe(currentAssistant);
    expect(turnNumber(messages)).toBe(2);
  });
});
