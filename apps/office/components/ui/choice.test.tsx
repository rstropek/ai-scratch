import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './checkbox.tsx';
import { ChoiceGroup } from './choice-group.tsx';
import { TextArea } from './text-area.tsx';

const options = [
  { value: 'teacher', label: 'Lehrkraft' },
  { value: 'parent', label: 'Eltern' },
];

describe('ChoiceGroup', () => {
  it('groups the options under the legend and keeps the chosen one', () => {
    render(<ChoiceGroup legend="Ich bin" type="radio" name="kind" options={options} defaultValue={['parent']} />);
    const group = screen.getByRole('group', { name: 'Ich bin' });
    expect(group).not.toBeInvalid();
    expect(screen.getByRole('radio', { name: 'Eltern' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Lehrkraft' })).not.toBeChecked();
  });

  it('marks the group invalid and reads the error', () => {
    render(<ChoiceGroup legend="Schulstufen" type="checkbox" name="g" options={options} error="Bitte wählen." />);
    const group = screen.getByRole('group', { name: 'Schulstufen' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription('Bitte wählen.');
  });
});

describe('Checkbox', () => {
  it('links its error to the box', () => {
    render(<Checkbox name="adult" label="Ich bin mindestens 18." error="Nur Erwachsene." />);
    const box = screen.getByRole('checkbox', { name: 'Ich bin mindestens 18.' });
    expect(box).toBeInvalid();
    expect(box).toHaveAccessibleDescription('Nur Erwachsene.');
  });
});

describe('TextArea', () => {
  it('counts the characters as they are typed', async () => {
    render(<TextArea label="Vorhaben" name="summary" maxLength={1000} defaultValue="abc" />);
    const field = screen.getByRole('textbox', { name: 'Vorhaben' });
    expect(field).toHaveAccessibleDescription('3 / 1000');
    await userEvent.type(field, 'de');
    expect(field).toHaveAccessibleDescription('5 / 1000');
  });
});
