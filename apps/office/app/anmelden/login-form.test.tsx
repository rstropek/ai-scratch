import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { texts } from '../../lib/texts.ts';
import { LoginForm } from './login-form.tsx';

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('../../lib/auth-client.ts', () => ({ authClient: { signIn: { email: mocks.signIn } } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));

const fillIn = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(texts.login.email), 'rainer@software-architects.at');
  await user.type(screen.getByLabelText(texts.login.password), 'correct horse battery');
  await user.click(screen.getByRole('button', { name: texts.login.submit }));
};

describe('LoginForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('signs in and goes to the start page', async () => {
    mocks.signIn.mockResolvedValue({ data: {}, error: null });
    render(<LoginForm />);
    await fillIn();
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: 'rainer@software-architects.at',
      password: 'correct horse battery',
    });
    expect(mocks.replace).toHaveBeenCalledWith('/');
  });

  it.each([
    [401, texts.login.failed],
    [429, texts.login.tooMany],
    [500, texts.login.error],
  ])('explains a failed sign-in (%i)', async (status, message) => {
    mocks.signIn.mockResolvedValue({ data: null, error: { status } });
    render(<LoginForm />);
    await fillIn();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: texts.login.submit })).toBeEnabled();
  });
});
