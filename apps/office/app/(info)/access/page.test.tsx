import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { access } from '../../../content/access.tsx';
import {
  BUDGET_ACCOUNT_EUR_MONTH,
  BUDGET_TOTAL_EUR_MONTH,
  CODE_BUDGET_EUR,
  CODE_MAX_HOURS,
  OWN_KEY_MAX_REMAINING_USD,
} from '../../../lib/rules.ts';
import AccessPage from './page.tsx';

const t = access.tour;
const steps = () => within(screen.getByRole('list', { name: t.stepsLabel })).getAllByRole('button');
const currentTitle = () =>
  within(screen.getByRole('region', { name: t.title })).getByRole('heading', { level: 3 }).textContent;

describe('the access page', () => {
  it('starts the tour at the first step', () => {
    render(<AccessPage />);
    expect(screen.getByRole('heading', { level: 1, name: access.title })).toBeVisible();
    expect(currentTitle()).toBe(t.steps[0]?.title);
    expect(steps()[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: t.back })).toBeDisabled();
  });

  it('walks forward and back, lights the step in the diagram and starts over after the last step', () => {
    const { container } = render(<AccessPage />);
    fireEvent.click(screen.getByRole('button', { name: t.next }));
    expect(currentTitle()).toBe(t.steps[1]?.title);
    expect(steps()[1]).toHaveAttribute('aria-current', 'step');
    expect(steps()[0]).not.toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('button', { name: t.back }));
    expect(currentTitle()).toBe(t.steps[0]?.title);

    const last = t.steps.length - 1;
    fireEvent.click(steps()[last] as HTMLElement);
    expect(currentTitle()).toBe(t.steps[last]?.title);
    const lit = [...container.querySelectorAll('[data-node][data-active]')].map((node) =>
      node.getAttribute('data-node'),
    );
    expect(lit).toEqual(expect.arrayContaining([...(t.steps[last]?.nodes ?? [])]));
    expect(lit).toHaveLength(t.steps[last]?.nodes.length ?? 0);
    fireEvent.click(screen.getByRole('button', { name: t.restart }));
    expect(currentTitle()).toBe(t.steps[0]?.title);
  });

  it('moves along the step buttons with the arrow keys', () => {
    render(<AccessPage />);
    const first = steps()[0] as HTMLElement;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(currentTitle()).toBe(t.steps[1]?.title);
    expect(steps()[1]).toHaveFocus();
    fireEvent.keyDown(steps()[1] as HTMLElement, { key: 'ArrowLeft' });
    fireEvent.keyDown(steps()[0] as HTMLElement, { key: 'ArrowLeft' });
    expect(currentTitle()).toBe(t.steps[0]?.title);
  });

  it('shows the limits from lib/rules.ts', () => {
    render(<AccessPage />);
    const table = screen.getByRole('region', { name: access.limits.title });
    for (const value of [
      `${CODE_MAX_HOURS} Stunden`,
      `${CODE_BUDGET_EUR} €`,
      `${BUDGET_ACCOUNT_EUR_MONTH} €`,
      `${BUDGET_TOTAL_EUR_MONTH} €`,
      `${OWN_KEY_MAX_REMAINING_USD} US-Dollar`,
    ])
      expect(table).toHaveTextContent(value);
  });
});
