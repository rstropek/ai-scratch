import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilterTabs } from './filter-tabs.tsx';

describe('FilterTabs', () => {
  it('marks the current view and shows the counts', () => {
    render(
      <FilterTabs
        label="Filter"
        tabs={[
          { href: '/admin?filter=pending', label: 'Offene Anträge', count: 3, current: true },
          { href: '/admin?filter=parents', label: 'Eltern', count: 0, current: false },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Filter' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Offene Anträge 3' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Eltern 0' })).not.toHaveAttribute('aria-current');
  });
});
