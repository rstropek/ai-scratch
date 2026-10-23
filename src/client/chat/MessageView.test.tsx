import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { ChatMessage } from '../../shared/chat-types.ts';
import { kidFriendlyError } from './errors.ts';
import { MessageView } from './MessageView.tsx';

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

describe('MessageView', () => {
  test('with tools shown: text, thinking, the status of each tool call and the token usage', () => {
    render(<MessageView message={message} showTools />);

    expect(screen.getByText('Schau mal!')).toBeInTheDocument();
    expect(screen.getByText(/denkt nach/)).toBeInTheDocument();
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
    const tools = screen.getAllByTestId('tool-call');
    expect(tools[0]).toHaveTextContent('show_tab{"tab":"costumes"}');
    expect(within(tools[0] as HTMLElement).getByLabelText('fertig')).toBeInTheDocument();
    expect(tools[1]).toHaveTextContent(/^add_scripts$/); // long arguments are not shown
    expect(within(tools[1] as HTMLElement).getByLabelText('läuft')).toBeInTheDocument();
    expect(tools[2]).toHaveTextContent('green_flag{} kaputt');
    expect(within(tools[2] as HTMLElement).getByLabelText('Fehler')).toBeInTheDocument();
    expect(screen.getByText(/1200 in \(1000 cached\) \/ 80 out/)).toBeInTheDocument();
    expect(screen.queryByTestId('working')).not.toBeInTheDocument();
  });

  test('with tools hidden: only the text and a friendly line while a tool is still running', () => {
    const { rerender } = render(<MessageView message={message} showTools={false} />);
    expect(screen.getByText('Schau mal!')).toBeInTheDocument();
    expect(screen.queryByTestId('tool-call')).not.toBeInTheDocument();
    expect(screen.queryByText(/cached/)).not.toBeInTheDocument();
    expect(screen.queryByText(/denkt nach/)).not.toBeInTheDocument(); // reasoning is done
    expect(screen.getByTestId('working')).toHaveTextContent('baut an deinem Projekt');

    const done = {
      ...message,
      parts: message.parts.map((p) =>
        p.type === 'tool-add_scripts' ? { ...p, state: 'output-available', output: {} } : p,
      ),
    } as ChatMessage;
    rerender(<MessageView message={done} showTools={false} />);
    expect(screen.queryByTestId('working')).not.toBeInTheDocument();
  });

  test("assistant text is rendered as Markdown, the kid's text stays as typed", () => {
    const chat = (role: 'user' | 'assistant', text: string) =>
      ({ id: role, role, parts: [{ type: 'text', text }] }) as ChatMessage;
    const { rerender } = render(<MessageView message={chat('assistant', '**Datei**\n\n- eins')} showTools={false} />);
    expect(screen.getByText('Datei').tagName).toBe('STRONG');
    expect(screen.getByRole('listitem')).toHaveTextContent('eins');

    rerender(<MessageView message={chat('user', '**Datei**')} showTools={false} />);
    expect(screen.getByTestId('user-text')).toHaveTextContent('**Datei**');
  });
});

describe('kidFriendlyError', () => {
  test('uses the German message from the server, otherwise a generic hint', () => {
    expect(kidFriendlyError(new Error('{"error":"Falscher Zugangscode"}'))).toBe('Falscher Zugangscode');
    expect(kidFriendlyError(new Error('Failed to fetch'))).toMatch(/Keine Verbindung/);
    expect(kidFriendlyError(new Error('boom'))).toMatch(/schiefgegangen/);
  });
});
