import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { LockerGame } from '../../shared/locker.ts';
import { LockerDialog, type LockerDialogProps } from './LockerDialog.tsx';
import { type LockerApi, LockerCallError, type LockerProject, storedLockerCode, storeLockerCode } from './locker.ts';

const CODE = 'K7QM4XRT';
const game = (name: string, n: number): LockerGame => ({
  projectId: `p${n}`,
  fileId: `f${n}`,
  name,
  savedAt: new Date(Date.now() - n * 60_000).toISOString(),
  size: 1000,
});
const GAMES = [game('Weltraum-Abenteuer', 1), game('Mein Chatbot', 2)];

const setup = (props: Partial<LockerDialogProps> = {}, api: Partial<LockerApi> = {}) => {
  const fullApi: LockerApi = {
    list: vi.fn(async () => GAMES),
    save: vi.fn(async (_code, name) => [game(name, 0), ...GAMES]),
    load: vi.fn(async () => new ArrayBuffer(4)),
    ...api,
  };
  const project: LockerProject = {
    title: vi.fn(() => 'Hai-Alarm'),
    sb3: vi.fn(async () => new Blob(['sb3'])),
    setTitle: vi.fn(),
    load: vi.fn(async () => {}),
  };
  const onClose = vi.fn();
  render(<LockerDialog action="save" api={fullApi} project={project} aiBusy={false} onClose={onClose} {...props} />);
  return { api: fullApi, project, onClose };
};

const typeCode = (code: string) => {
  fireEvent.change(screen.getByLabelText('Tipp deinen Locker-Code ein.'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Locker öffnen' }));
};

afterEach(() => sessionStorage.clear());

describe('LockerDialog', () => {
  test('without the school code it points to the chat', () => {
    setup({ api: undefined });
    expect(screen.getByText('Zuerst den Zugangscode')).toBeInTheDocument();
  });

  test('the sticker code is typed the forgiving way, then remembered for this tab', async () => {
    const { api } = setup();
    const field = screen.getByLabelText('Tipp deinen Locker-Code ein.');
    expect(screen.getByRole('button', { name: 'Locker öffnen' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'k7qm4xr' } });
    expect(field).toHaveValue('K7QM 4XR');
    expect(screen.getByRole('button', { name: 'Locker öffnen' })).toBeDisabled();
    typeCode('k7qm 4xrt');
    expect(await screen.findByLabelText('Wie heißt dein Spiel?')).toHaveValue('Hai-Alarm');
    expect(api.list).toHaveBeenCalledWith(CODE);
    expect(storedLockerCode()).toBe(CODE);
    expect(screen.getByText('K7QM 4XRT')).toBeInTheDocument();
  });

  test('a wrong code stays in the field with the Locker sentence', async () => {
    setup(
      {},
      {
        list: vi.fn(async () =>
          Promise.reject(new LockerCallError('Mit diesem Code geht kein Locker auf.', 'not-found')),
        ),
      },
    );
    typeCode('K7QM4XRY');
    expect(await screen.findByRole('alert')).toHaveTextContent('Mit diesem Code geht kein Locker auf.');
    expect(screen.getByLabelText('Tipp deinen Locker-Code ein.')).toHaveValue('K7QM 4XRY');
    expect(storedLockerCode()).toBeUndefined();
  });

  test('a new name saves a new game and becomes the title', async () => {
    storeLockerCode(CODE);
    const { api, project } = setup();
    await screen.findByLabelText('Wie heißt dein Spiel?');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Gespeichert!')).toBeInTheDocument();
    expect(api.save).toHaveBeenCalledWith(CODE, 'Hai-Alarm', expect.any(Blob), undefined);
    expect(project.setTitle).toHaveBeenCalledWith('Hai-Alarm');
  });

  test('an existing name warns, turns the button into "Ersetzen" and replaces that game', async () => {
    storeLockerCode(CODE);
    const { api, project } = setup();
    const field = await screen.findByLabelText('Wie heißt dein Spiel?');
    fireEvent.change(field, { target: { value: ' weltraum-abenteuer ' } });
    expect(screen.getByRole('status')).toHaveTextContent('„Weltraum-Abenteuer“ ist schon in deinem Locker');
    expect(screen.getByRole('button', { name: /Weltraum-Abenteuer/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ersetzen' }));
    await screen.findByText('Gespeichert!');
    expect(api.save).toHaveBeenCalledWith(CODE, 'Weltraum-Abenteuer', expect.any(Blob), GAMES[0]);
    expect(project.setTitle).toHaveBeenCalledWith('Weltraum-Abenteuer');
  });

  test('clicking a game in the list takes over its name', async () => {
    storeLockerCode(CODE);
    setup();
    await screen.findByLabelText('Wie heißt dein Spiel?');
    fireEvent.click(screen.getByRole('button', { name: /Mein Chatbot/ }));
    expect(screen.getByLabelText('Wie heißt dein Spiel?')).toHaveValue('Mein Chatbot');
  });

  test('a failed save keeps the form and says why', async () => {
    storeLockerCode(CODE);
    setup({}, { save: vi.fn(async () => Promise.reject(new LockerCallError('Dein Locker ist voll.', 'other'))) });
    await screen.findByLabelText('Wie heißt dein Spiel?');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dein Locker ist voll.');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });

  test('loading: pick a game, then "Laden" replaces the project and closes', async () => {
    storeLockerCode(CODE);
    const { api, project, onClose } = setup({ action: 'load' });
    const laden = await screen.findByRole('button', { name: 'Laden' });
    expect(laden).toBeDisabled();
    expect(screen.getByText('Das Projekt, das gerade offen ist, wird dabei ersetzt.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Mein Chatbot/ }));
    fireEvent.click(laden);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.load).toHaveBeenCalledWith(CODE, GAMES[1]);
    expect(project.load).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'Mein Chatbot');
  });

  test('loading waits while the KI-Helfer works', async () => {
    storeLockerCode(CODE);
    setup({ action: 'load', aiBusy: true });
    fireEvent.click(await screen.findByRole('radio', { name: /Mein Chatbot/ }));
    expect(screen.getByRole('button', { name: 'Laden' })).toBeDisabled();
    expect(screen.getByText(/Warte, bis der KI-Helfer fertig ist/)).toBeInTheDocument();
  });

  test('an empty Locker teaches the way in', async () => {
    storeLockerCode(CODE);
    setup({ action: 'load' }, { list: vi.fn(async () => []) });
    expect(await screen.findByText('Dein Locker ist noch leer')).toBeInTheDocument();
  });

  test('an unreachable Locker offers to try again', async () => {
    storeLockerCode(CODE);
    const list = vi
      .fn<LockerApi['list']>()
      .mockRejectedValueOnce(new LockerCallError('Der Locker antwortet gerade nicht.', 'other'))
      .mockResolvedValue(GAMES);
    setup({ action: 'load' }, { list });
    fireEvent.click(await screen.findByRole('button', { name: 'Nochmal versuchen' }));
    expect(await screen.findByRole('radio', { name: /Weltraum-Abenteuer/ })).toBeInTheDocument();
  });

  test('"Anderer Code" forgets the code and asks again', async () => {
    storeLockerCode(CODE);
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Anderer Code' }));
    expect(screen.getByLabelText('Tipp deinen Locker-Code ein.')).toHaveValue('');
    expect(storedLockerCode()).toBeUndefined();
  });

  test('"open": the typed code opens the Locker\'s page in a new tab, without asking our server', async () => {
    const tab = { opener: window } as unknown as Window;
    const windowOpen = vi.spyOn(window, 'open').mockReturnValue(tab);
    const { api, onClose } = setup({ action: 'open', api: undefined });
    expect(screen.getByRole('heading')).toHaveTextContent('Locker in neuem Tab öffnen');
    typeCode('k7qm 4xrt');
    expect(windowOpen).toHaveBeenCalledWith('https://locker.coderdojo.net/locker/K7QM4XRT', '_blank');
    expect(tab.opener).toBeNull();
    expect(onClose).toHaveBeenCalled();
    expect(api.list).not.toHaveBeenCalled();
    expect(storedLockerCode()).toBe(CODE);
    windowOpen.mockRestore();
  });

  test('"open": when the browser blocks the tab, a real link opens it', async () => {
    const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    const { onClose } = setup({ action: 'open' });
    typeCode(CODE);
    const link = screen.getByRole('link', { name: 'Locker öffnen' });
    expect(link).toHaveAttribute('href', 'https://locker.coderdojo.net/locker/K7QM4XRT');
    expect(link).toHaveAttribute('target', '_blank');
    expect(onClose).not.toHaveBeenCalled();
    windowOpen.mockRestore();
  });

  test('Escape closes, but not halfway through a save', async () => {
    storeLockerCode(CODE);
    let finish: (games: LockerGame[]) => void = () => {};
    const { onClose } = setup({}, { save: vi.fn(() => new Promise<LockerGame[]>((r) => (finish = r))) });
    await screen.findByLabelText('Wie heißt dein Spiel?');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await screen.findByRole('button', { name: /Wird gespeichert/ });
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish(GAMES));
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalled();
  });
});
