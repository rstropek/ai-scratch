import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { terms } from '../../../content/terms.tsx';
import { CONTACT_EMAIL, SOURCE_URL } from '../../../lib/site.ts';
import TermsPage from './page.tsx';

describe('the terms page', () => {
  it('shows the title, the date and the key points first', () => {
    render(<TermsPage />);
    expect(screen.getByRole('heading', { level: 1, name: terms.title })).toBeVisible();
    expect(screen.getByText(terms.date)).toBeVisible();
    const keyPoints = screen.getByRole('region', { name: terms.keyPointsTitle });
    for (const point of terms.keyPoints) expect(keyPoints).toHaveTextContent(point);
  });

  it('numbers its sections in order and gives each a unique anchor', () => {
    render(<TermsPage />);
    const sections = screen
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.textContent !== terms.keyPointsTitle);
    expect(sections.map((heading) => Number.parseInt(heading.textContent ?? '', 10))).toEqual(
      sections.map((_, index) => index + 1),
    );
    const ids = sections.map((heading) => heading.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links only to anchors that exist', () => {
    const { container } = render(<TermsPage />);
    const anchors = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) expect(container.querySelector(anchor.getAttribute('href') ?? '')).not.toBeNull();
  });

  it('links the source code and the contact address', () => {
    render(<TermsPage />);
    expect(screen.getByRole('link', { name: 'github.com/rstropek/ai-scratch' })).toHaveAttribute('href', SOURCE_URL);
    for (const mail of screen.getAllByRole('link', { name: CONTACT_EMAIL }))
      expect(mail).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
  });
});
