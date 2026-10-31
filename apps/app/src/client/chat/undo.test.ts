import { describe, expect, test } from 'vitest';
import type { ChatMessage } from '../../shared/chat-types.ts';
import { backupIdFor, changedProject, markUndone } from './undo.ts';

const kid = (id: string): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text: 'bau was' }] });
const answer = (id: string, tool: string, state = 'output-available'): ChatMessage =>
  ({
    id,
    role: 'assistant',
    parts: [{ type: `tool-${tool}`, toolCallId: `${id}-c`, state, input: {}, output: {} }],
  }) as ChatMessage;

describe('undo', () => {
  test('only answers whose project-changing tools ran count as changes', () => {
    expect(changedProject(answer('a', 'add_scripts'))).toBe(true);
    expect(changedProject(answer('a', 'draw_sprite'))).toBe(true);
    expect(changedProject(answer('a', 'show_tab'))).toBe(false);
    expect(changedProject(answer('a', 'green_flag'))).toBe(false);
    expect(changedProject(answer('a', 'add_scripts', 'output-error'))).toBe(false);
    expect(changedProject(kid('k'))).toBe(false);
  });

  test('an answer is undone with the project saved by the kid message before it', () => {
    const messages = [kid('k1'), answer('a1', 'add_scripts'), kid('k2'), answer('a2', 'add_scripts')];
    expect(backupIdFor(messages, 1)).toBe('k1');
    expect(backupIdFor(messages, 3)).toBe('k2');
  });

  test('undoing an answer also undoes every later change, but not the earlier ones', () => {
    const messages = [
      kid('k1'),
      answer('a1', 'add_scripts'),
      kid('k2'),
      answer('a2', 'draw_sprite'),
      kid('k3'),
      answer('a3', 'show_tab'),
      kid('k4'),
      answer('a4', 'clear_scripts'),
    ];
    const undone = markUndone(messages, 3).map((m) => (m.metadata?.undone ? m.id : undefined));
    expect(undone.filter(Boolean)).toEqual(['a2', 'a4']);
  });
});
