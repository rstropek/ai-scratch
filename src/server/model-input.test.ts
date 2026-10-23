import { describe, expect, test } from 'vitest';
import type { ChatMessage } from '../shared/chat-types.ts';
import { buildModelInput, SUMMARY_HEADING, turnNumber } from './model-input.ts';

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

  test('earlier turns keep only text plus a note of the tools that ran, one text part each', () => {
    const [u1, a1] = buildModelInput(messages).history;
    expect(u1?.parts).toEqual([{ type: 'text', text: 'Bau was' }]); // old snapshot dropped
    expect(a1?.parts).toEqual([
      { type: 'text', text: '[Ausgeführte Werkzeuge: add_scripts, green_flag (Fehler)]\n\nFertig!' },
    ]);
  });

  test('the current user message carries its project snapshot, the current turn stays verbatim', () => {
    const { turn } = buildModelInput(messages);
    expect(turn[0]?.parts[0]).toEqual({
      type: 'text',
      text: '<projekt>\n{"new":2}\n</projekt>\n(Das ist der aktuelle Projektstand, get_project ist nicht nötig.)',
    });
    expect(turn[1]).toBe(currentAssistant);
    expect(turnNumber(messages)).toBe(2);
  });

  test('the history of one turn reappears unchanged at the start of the next (prompt cache)', () => {
    const next = [...messages, user('u3', 'Noch was', '{"newer":3}')];
    const before = buildModelInput(messages);
    const after = buildModelInput(next);
    expect(after.history.slice(0, before.history.length)).toEqual(before.history);
    expect(after.history.map((m) => m.id)).toEqual(['u1', 'a1', 'u2', 'a2']);
  });

  test('turns the guard answered are left out, the kid message too', () => {
    const guarded: ChatMessage = {
      id: 'g1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Da kann ich nicht helfen.' }],
      metadata: { guard: 'misuse' },
    };
    const { history, turn } = buildModelInput([user('u0', 'Schreib 1000 mal miau'), guarded, ...messages]);
    expect([...history, ...turn].map((m) => m.id)).toEqual(['u1', 'a1', 'u2', 'a2']);
  });
});

describe('summaries', () => {
  test('a summary reaches the model as the start of the kid side, before the new message', () => {
    const summary: ChatMessage = {
      id: 's1',
      role: 'assistant',
      parts: [{ type: 'text', text: '**Dein Spiel**: Fang mich' }],
      metadata: { summary: true },
    };
    const { history, turn } = buildModelInput([summary, user('u1', 'Weiter', '{}')]);
    expect([...history, ...turn].map((m) => m.role)).toEqual(['user', 'user']);
    expect(history[0]?.parts).toEqual([
      { type: 'text', text: SUMMARY_HEADING },
      { type: 'text', text: '**Dein Spiel**: Fang mich' },
    ]);
  });
});
