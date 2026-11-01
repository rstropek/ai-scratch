import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AccessGate, type AccessGateProps } from './AccessGate.tsx';

const renderGate = (props: Partial<AccessGateProps> = {}) => {
  const onCode = vi.fn();
  render(
    <AccessGate checking={false} onCode={onCode} fontSize={16} onFontSize={vi.fn()} onFold={vi.fn()} {...props} />,
  );
  return {
    onCode,
    field: screen.getByLabelText('Zugangscode'),
    button: screen.getByRole('button', { name: /Los|prüfe/ }),
  };
};

describe('AccessGate', () => {
  test('asks only for the code, and tells adults where codes come from', () => {
    renderGate();
    expect(screen.getByTestId('access-welcome')).toHaveTextContent('Tipp den Zugangscode ein');
    expect(screen.getByRole('link', { name: 'office.ai-scratch.dev' })).toHaveAttribute(
      'href',
      'https://office.ai-scratch.dev',
    );
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  test('sends the typed code, normalized; an empty field sends nothing', () => {
    const { onCode, field, button } = renderGate();
    expect(button).toBeDisabled();
    fireEvent.change(field, { target: { value: '   ' } });
    expect(button).toBeDisabled();
    fireEvent.change(field, { target: { value: ' Tiger Apfel 48 ' } });
    fireEvent.click(button);
    expect(onCode).toHaveBeenCalledExactlyOnceWith('tiger-apfel-48');
  });

  test('Enter in the field sends too', () => {
    const { onCode, field } = renderGate();
    fireEvent.change(field, { target: { value: 'TIGER-APFEL-48' } });
    fireEvent.submit(field);
    expect(onCode).toHaveBeenCalledWith('tiger-apfel-48');
  });

  test('while checking a remembered code, field and button are disabled', () => {
    const { field, button } = renderGate({ checking: true, initialCode: 'tiger-apfel-48' });
    expect(field).toBeDisabled();
    expect(field).toHaveValue('tiger-apfel-48');
    expect(button).toHaveTextContent('prüfe…');
    expect(button).toBeDisabled();
  });

  test('shows why the code did not work, tied to the field', () => {
    const { field } = renderGate({ error: 'Dieser Code stimmt nicht.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Dieser Code stimmt nicht.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Dieser Code stimmt nicht.');
  });

  test('has no tool toggle: there is nothing to show yet', () => {
    renderGate();
    expect(screen.queryByRole('button', { name: 'Werkzeuge anzeigen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Chat einklappen' })).toBeInTheDocument();
  });
});
