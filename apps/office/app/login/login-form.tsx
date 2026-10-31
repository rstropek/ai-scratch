'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Banner } from '../../components/ui/banner.tsx';
import { Button } from '../../components/ui/button.tsx';
import { TextField } from '../../components/ui/text-field.tsx';
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
    <form onSubmit={submit} className="grid gap-4">
      <TextField label={texts.login.email} name="email" type="email" autoComplete="username" required />
      <TextField
        label={texts.login.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {error && <Banner tone="error">{error}</Banner>}
      <Button type="submit" pending={pending}>
        {pending ? texts.login.submitting : texts.login.submit}
      </Button>
    </form>
  );
}
