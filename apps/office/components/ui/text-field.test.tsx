import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from './text-field.tsx';

describe('TextField', () => {
  it('links the label and the hint to the input', () => {
    render(<TextField label="E-Mail-Adresse" hint="Am besten Ihre dienstliche Adresse." />);
    const input = screen.getByLabelText('E-Mail-Adresse');
    expect(input).toHaveAccessibleDescription('Am besten Ihre dienstliche Adresse.');
    expect(input).not.toBeInvalid();
  });

  it('marks the input invalid and reads the error with the hint', () => {
    render(<TextField label="E-Mail-Adresse" hint="Dienstlich." error="Diese E-Mail-Adresse ist unvollständig." />);
    const input = screen.getByLabelText('E-Mail-Adresse');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Dienstlich. Diese E-Mail-Adresse ist unvollständig.');
  });
});
