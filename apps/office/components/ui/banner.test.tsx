import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Banner } from './banner.tsx';

describe('Banner', () => {
  it('announces errors at once', () => {
    render(<Banner tone="error" title="Speichern hat nicht geklappt." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Speichern hat nicht geklappt.');
  });

  it('announces everything else politely', () => {
    render(<Banner tone="success">Code erstellt.</Banner>);
    expect(screen.getByRole('status')).toHaveTextContent('Code erstellt.');
  });

  it('announces nothing when it is a standing note', () => {
    render(
      <Banner tone="warning" title="Kein offizielles Angebot von Scratch" announce={false}>
        Hinweis
      </Banner>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Kein offizielles Angebot von Scratch')).toBeVisible();
  });
});
