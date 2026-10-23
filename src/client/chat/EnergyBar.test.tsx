import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { EnergyBar, type EnergyBarProps, type MemoryActionsProps } from './EnergyBar.tsx';

const renderBar = (props: Partial<EnergyBarProps> = {}, memoryProps: Partial<MemoryActionsProps> = {}) => {
  const memory = {
    canCompact: true,
    canClear: true,
    busy: false,
    compacting: false,
    onCompact: vi.fn(),
    onClear: vi.fn(),
    ...memoryProps,
  };
  render(
    <EnergyBar hearts={3} refill={0} nextHeartInMs={0} admin={false} context={undefined} memory={memory} {...props} />,
  );
  return memory;
};

const heartStates = () => screen.getAllByTestId('heart').map((h) => h.dataset.fill);

describe('EnergyBar', () => {
  test('shows the hearts left and when the next one comes', () => {
    renderBar({ hearts: 1, refill: 0.4, nextHeartInMs: 12_000 });
    expect(heartStates()).toEqual(['full', 'empty', 'empty']);
    expect(screen.getByTestId('hearts')).toHaveAttribute('title', 'Noch 1 Nachricht · nächstes Herz in 12 s');
    expect(screen.getByTestId('hearts')).toHaveTextContent('12 s');
  });

  test('admin codes keep all hearts', () => {
    renderBar({ hearts: 3, admin: true });
    expect(heartStates()).toEqual(['full', 'full', 'full']);
    expect(screen.getByTestId('hearts')).toHaveTextContent('Admin: Nachrichten ohne Limit');
  });

  test('the gauge shows the share of the limit and opens the ways to free the memory', () => {
    const memory = renderBar({ context: 30_000 });
    const gauge = screen.getByRole('button', { name: 'Gedächtnis: 38 % voll' });
    expect(gauge).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(gauge);
    expect(screen.getByText(/^30\s000 von 80\s000 Tokens$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zusammenfassen' }));
    expect(memory.onCompact).toHaveBeenCalledOnce();

    // clearing asks first
    fireEvent.click(screen.getByRole('button', { name: 'Neu anfangen' }));
    expect(memory.onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ja, neu anfangen' }));
    expect(memory.onClear).toHaveBeenCalledOnce();
  });

  test('a running turn disables the actions; the gauge stops at 100 %', () => {
    renderBar({ context: 90_000 }, { busy: true, compacting: true });
    fireEvent.click(screen.getByRole('button', { name: 'Gedächtnis: 100 % voll' }));
    expect(screen.getByRole('button', { name: 'fasse zusammen…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Neu anfangen' })).toBeDisabled();
  });
});
