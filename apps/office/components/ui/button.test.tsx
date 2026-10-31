import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button.tsx';

describe('Button', () => {
  it('is a plain button unless told otherwise', () => {
    render(<Button>Code erstellen</Button>);
    expect(screen.getByRole('button', { name: 'Code erstellen' })).toHaveAttribute('type', 'button');
  });

  it('is disabled and busy while pending', () => {
    render(<Button pending>Wird gespeichert …</Button>);
    const button = screen.getByRole('button', { name: 'Wird gespeichert …' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
