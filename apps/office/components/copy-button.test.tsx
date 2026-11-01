import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './copy-button.tsx';

const stubClipboard = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

describe('CopyButton', () => {
  afterEach(() => vi.useRealTimers());

  it('copies the value and says so for a moment', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    render(<CopyButton value="TIGER-APFEL-48" label="Code kopieren" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Code kopieren' })));
    expect(writeText).toHaveBeenCalledWith('TIGER-APFEL-48');
    expect(screen.getByRole('status')).toHaveTextContent('Kopiert');
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('tells when the browser refuses', async () => {
    stubClipboard(async () => {
      throw new Error('denied');
    });
    render(<CopyButton value="TIGER-APFEL-48" label="Code kopieren" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Code kopieren' })));
    expect(screen.getByRole('status')).toHaveTextContent('Kopieren hat nicht geklappt');
  });
});
