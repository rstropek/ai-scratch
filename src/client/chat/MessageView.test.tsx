import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { ChatMessage } from '../../shared/chat-types.ts';
import { kidFriendlyError } from './errors.ts';
import { MessageView } from './MessageView.tsx';

describe('MessageView', () => {
  test('shows text, thinking and the status of each tool call', () => {
    const message = {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'hidden', state: 'done' },
        { type: 'tool-show_tab', toolCallId: 'c1', state: 'output-available', input: { tab: 'costumes' }, output: {} },
        { type: 'tool-add_scripts', toolCallId: 'c2', state: 'input-available', input: { scripts: [['long']] } },
        { type: 'tool-green_flag', toolCallId: 'c3', state: 'output-error', input: {}, errorText: 'kaputt' },
        { type: 'text', text: 'Schau mal!' },
      ],
      metadata: { usage: { inputTokens: 1200, outputTokens: 80, inputTokenDetails: { cacheReadTokens: 1000 } } },
    } as ChatMessage;
    render(<MessageView message={message} />);

    expect(screen.getByText('Schau mal!')).toBeInTheDocument();
    expect(screen.getByText(/denkt nach/)).toBeInTheDocument();
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
    const tools = screen.getAllByTestId('tool-call').map((e) => e.textContent);
    expect(tools[0]).toMatch(/show_tab\{"tab":"costumes"\} ✓/);
    expect(tools[1]).toMatch(/add_scripts …/); // long arguments are not shown
    expect(tools[2]).toMatch(/green_flag\{\} ✗ kaputt/);
    expect(screen.getByText(/1200 in \(1000 cached\) \/ 80 out/)).toBeInTheDocument();
  });
});

describe('kidFriendlyError', () => {
  test('uses the German message from the server, otherwise a generic hint', () => {
    expect(kidFriendlyError(new Error('{"error":"Falscher Zugangscode"}'))).toBe('Falscher Zugangscode');
    expect(kidFriendlyError(new Error('Failed to fetch'))).toMatch(/Keine Verbindung/);
    expect(kidFriendlyError(new Error('boom'))).toMatch(/schiefgegangen/);
  });
});
