import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ChatTopBar } from './ChatTopBar.tsx';

const renderBar = (props: Partial<Parameters<typeof ChatTopBar>[0]> = {}) => {
  const handlers = { onFontSize: vi.fn(), onShowTools: vi.fn(), onFold: vi.fn() };
  render(<ChatTopBar fontSize={16} showTools={false} {...handlers} {...props} />);
  return handlers;
};

describe('ChatTopBar', () => {
  test('font buttons step the size and stop at the limits', () => {
    const { onFontSize } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Schrift größer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schrift kleiner' }));
    expect(onFontSize.mock.calls).toEqual([[18], [14]]);
  });

  test('font buttons are disabled at the smallest and largest size', () => {
    renderBar({ fontSize: 14 });
    expect(screen.getByRole('button', { name: 'Schrift kleiner' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Schrift größer' })).toBeEnabled();
  });

  test('the tool toggle reports its state and flips it', () => {
    const { onShowTools } = renderBar({ showTools: true });
    const toggle = screen.getByRole('button', { name: 'Werkzeuge anzeigen' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(onShowTools).toHaveBeenCalledWith(false);
  });

  test('fold calls back', () => {
    const { onFold } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Chat einklappen' }));
    expect(onFold).toHaveBeenCalledOnce();
  });
});
