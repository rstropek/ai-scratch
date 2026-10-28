import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { AccessGate, type AccessGateProps } from './AccessGate.tsx';

const KEY = 'sk-or-v1-AbCdEf0123456789';

// jsdom has no modal dialogs
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
});

const renderGate = (props: Partial<AccessGateProps> = {}) => {
  const onCode = vi.fn();
  render(
    <AccessGate checking={false} onCode={onCode} fontSize={16} onFontSize={vi.fn()} onFold={vi.fn()} {...props} />,
  );
  return { onCode };
};

const choose = (answer: RegExp) => fireEvent.click(screen.getByRole('button', { name: answer }));
const schoolCode = () => {
  choose(/Ich habe einen Zugangscode/);
  return {
    field: screen.getByLabelText('Zugangscode'),
    button: screen.getByRole('button', { name: /Los|prüfe/ }),
  };
};
const parentsKey = () => {
  choose(/Ich nutze einen eigenen Schlüssel/);
  return {
    field: screen.getByLabelText('OpenRouter-Schlüssel'),
    agree: screen.getByRole('checkbox', { name: /volljährig/ }),
    button: screen.getByRole('button', { name: /Schlüssel prüfen|prüfe/ }),
  };
};

describe('AccessGate', () => {
  test('the kid chooses first: no field until one of the two answers is picked, and it can be changed', () => {
    renderGate();
    expect(screen.queryByRole('textbox')).toBeNull();
    schoolCode();
    expect(screen.getByText('Ich habe einen Zugangscode')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ändern' }));
    expect(screen.queryByLabelText('Zugangscode')).toBeNull();
    parentsKey();
    expect(screen.getByTestId('parents-sheet')).toHaveTextContent('Für Eltern');
  });

  test('sends the typed code, normalized; an empty field sends nothing', () => {
    const { onCode } = renderGate();
    const { field, button } = schoolCode();
    expect(button).toBeDisabled();
    fireEvent.change(field, { target: { value: '   ' } });
    expect(button).toBeDisabled();
    fireEvent.change(field, { target: { value: ' Schule1 ' } });
    fireEvent.click(button);
    expect(onCode).toHaveBeenCalledExactlyOnceWith('schule1');
  });

  test('Enter in the field sends too', () => {
    const { onCode } = renderGate();
    const { field } = schoolCode();
    fireEvent.change(field, { target: { value: 'schule1' } });
    fireEvent.submit(field);
    expect(onCode).toHaveBeenCalledWith('schule1');
  });

  test('a key in the code field is not sent: the kid is told to pick the other answer', () => {
    const { onCode } = renderGate();
    const { field } = schoolCode();
    fireEvent.change(field, { target: { value: KEY } });
    fireEvent.submit(field);
    expect(onCode).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Das ist ein OpenRouter-Schlüssel/);
  });

  test('while checking a remembered code, its path is open and field and button are disabled', () => {
    renderGate({ checking: true, initialCode: 'schule1' });
    const field = screen.getByLabelText('Zugangscode');
    const button = screen.getByRole('button', { name: /prüfe/ });
    expect(field).toBeDisabled();
    expect(field).toHaveValue('schule1');
    expect(button).toHaveTextContent('prüfe…');
    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ändern' })).toBeDisabled();
  });

  test('shows why the code did not work, tied to the field', () => {
    renderGate({ error: 'Dieser Code stimmt nicht.', initialPath: 'school' });
    const field = screen.getByLabelText('Zugangscode');
    expect(screen.getByRole('alert')).toHaveTextContent('Dieser Code stimmt nicht.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Dieser Code stimmt nicht.');
  });

  test('the key is sent unchanged in case, only with the terms agreed to', () => {
    const { onCode } = renderGate();
    const { field, agree, button } = parentsKey();
    expect(field).toHaveAttribute('type', 'password');
    fireEvent.change(field, { target: { value: ` ${KEY} ` } });
    fireEvent.click(button);
    expect(onCode).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte setzen Sie zuerst dieses Häkchen.');
    expect(agree).toHaveFocus();
    fireEvent.click(agree);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(button);
    expect(onCode).toHaveBeenCalledExactlyOnceWith(KEY);
  });

  test('a school code in the key field is not sent', () => {
    const { onCode } = renderGate();
    const { field, agree, button } = parentsKey();
    fireEvent.click(agree);
    fireEvent.change(field, { target: { value: 'schule1' } });
    fireEvent.click(button);
    expect(onCode).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/kein OpenRouter-Schlüssel/);
  });

  test('the key can be shown, and agreeing in the full terms ticks the box', () => {
    renderGate();
    const { field, agree } = parentsKey();
    fireEvent.click(screen.getByRole('button', { name: 'Schlüssel anzeigen' }));
    expect(field).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Nutzungsbedingungen ganz lesen' }));
    const dialog = screen.getByRole('dialog', { name: 'Nutzungsbedingungen' });
    expect(dialog).toHaveTextContent('Wir sichern keinen Ort der Verarbeitung zu.');
    expect(dialog).toHaveTextContent('github.com/rstropek/ai-scratch');
    fireEvent.click(screen.getByRole('button', { name: 'Gelesen, ich stimme zu' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(agree).toBeChecked();
  });

  test("a refused key comes back on the parents' path, with the box still ticked", () => {
    renderGate({ initialCode: KEY, initialAgreed: true, error: 'Dieser Schlüssel hat kein Ausgabelimit.' });
    expect(screen.getByLabelText('OpenRouter-Schlüssel')).toHaveValue(KEY);
    expect(screen.getByRole('checkbox', { name: /volljährig/ })).toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent('kein Ausgabelimit');
  });

  test('has no tool toggle: there is nothing to show yet', () => {
    renderGate();
    expect(screen.queryByRole('button', { name: 'Werkzeuge anzeigen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Schlüssel vergessen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Chat einklappen' })).toBeInTheDocument();
  });
});
