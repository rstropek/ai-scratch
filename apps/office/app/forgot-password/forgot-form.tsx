'use client';

import { MailCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Banner } from '../../components/ui/banner.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Panel } from '../../components/ui/panel.tsx';
import { StatePanel } from '../../components/ui/state-panel.tsx';
import { TextField } from '../../components/ui/text-field.tsx';
import { authClient } from '../../lib/auth-client.ts';
import { texts } from '../../lib/texts.ts';

const t = texts.forgot;

/** Through /api/auth from the browser, so better-auth's rate limit applies. Answers the same for every address. */
export function ForgotForm() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get('email')),
      redirectTo: '/reset-password',
    });
    setPending(false);
    if (error) setError(error.status === 429 ? t.tooMany : t.error);
    else setSent(true);
  };

  if (sent)
    return (
      <StatePanel icon={MailCheck} tone="success" title={t.sentTitle}>
        <p>{t.sent}</p>
      </StatePanel>
    );
  return (
    <Panel className="grid gap-5">
      <h1 className="font-bold text-2xl">{t.title}</h1>
      <p className="text-sm">{t.intro}</p>
      <form onSubmit={submit} className="grid gap-4">
        <TextField label={t.email} name="email" type="email" autoComplete="email" required />
        {error && <Banner tone="error">{error}</Banner>}
        <Button type="submit" pending={pending}>
          {pending ? t.submitting : t.submit}
        </Button>
      </form>
    </Panel>
  );
}
