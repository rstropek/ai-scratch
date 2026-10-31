'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Banner } from '../../components/ui/banner.tsx';
import { Button, buttonClass } from '../../components/ui/button.tsx';
import { Panel } from '../../components/ui/panel.tsx';
import { StatePanel } from '../../components/ui/state-panel.tsx';
import { TextField } from '../../components/ui/text-field.tsx';
import { authClient } from '../../lib/auth-client.ts';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../../lib/rules.ts';
import { texts } from '../../lib/texts.ts';
import { LinkInvalid } from './link-invalid.tsx';

const t = texts.reset;

export function ResetForm({ token }: { token: string }) {
  const [errors, setErrors] = useState<{ password?: string; passwordRepeat?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'invalid'>('form');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password.length < MIN_PASSWORD_LENGTH)
      return setErrors({ password: texts.validation.passwordShort(MIN_PASSWORD_LENGTH) });
    if (password.length > MAX_PASSWORD_LENGTH)
      return setErrors({ password: texts.validation.passwordLong(MAX_PASSWORD_LENGTH) });
    if (password !== form.get('passwordRepeat')) return setErrors({ passwordRepeat: texts.validation.passwordRepeat });
    setPending(true);
    setErrors({});
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (!error) setState('done');
    else if (error.code === 'INVALID_TOKEN') setState('invalid');
    else setErrors({ form: t.error });
  };

  if (state === 'done')
    return (
      <StatePanel
        icon={CircleCheck}
        tone="success"
        title={t.doneTitle}
        actions={
          <Link href="/login" className={buttonClass()}>
            {texts.login.submit}
          </Link>
        }
      >
        <p>{t.done}</p>
      </StatePanel>
    );
  if (state === 'invalid') return <LinkInvalid />;
  return (
    <Panel className="grid gap-5">
      <h1 className="font-bold text-2xl">{t.title}</h1>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <TextField
          label={t.password}
          hint={texts.confirm.passwordHint(MIN_PASSWORD_LENGTH)}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={errors.password}
        />
        <TextField
          label={t.passwordRepeat}
          name="passwordRepeat"
          type="password"
          autoComplete="new-password"
          required
          error={errors.passwordRepeat}
        />
        {errors.form && <Banner tone="error">{errors.form}</Banner>}
        <Button type="submit" pending={pending}>
          {pending ? t.submitting : t.submit}
        </Button>
      </form>
    </Panel>
  );
}
