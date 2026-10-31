'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { authClient } from '../../lib/auth-client.ts';
import { texts } from '../../lib/texts.ts';

const errorText = (status: number) => {
  if (status === 401) return texts.login.failed;
  if (status === 429) return texts.login.tooMany;
  return texts.login.error;
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const { error } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (error) {
      setError(errorText(error.status));
      setPending(false);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 font-medium text-sm">
        {texts.login.email}
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-base"
        />
      </label>
      <label className="flex flex-col gap-1 font-medium text-sm">
        {texts.login.password}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-base"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-red-800 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? texts.login.submitting : texts.login.submit}
      </button>
    </form>
  );
}
