'use client';

import { useActionState } from 'react';
import { Banner } from '../../../components/ui/banner.tsx';
import { Button } from '../../../components/ui/button.tsx';
import { TextField } from '../../../components/ui/text-field.tsx';
import { answerOf } from '../../../lib/form-state.ts';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../../../lib/rules.ts';
import { texts } from '../../../lib/texts.ts';
import { type ConfirmState, createAccount } from './actions.ts';
import { LinkProblem } from './link-problem.tsx';

const t = texts.confirm;

export function ConfirmForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(createAccount.bind(null, token), {} as ConfirmState);
  const errors = state.fieldErrors ?? {};
  if (state.link) return <LinkProblem state={state.link} />;
  return (
    <form action={action} noValidate className="grid gap-4">
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      {/* for password managers: the account's name */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.firstName}
          name="firstName"
          autoComplete="given-name"
          required
          defaultValue={answerOf(state, 'firstName')}
          error={errors.firstName}
        />
        <TextField
          label={t.lastName}
          name="lastName"
          autoComplete="family-name"
          required
          defaultValue={answerOf(state, 'lastName')}
          error={errors.lastName}
        />
      </div>
      <TextField
        label={t.password}
        hint={t.passwordHint(MIN_PASSWORD_LENGTH)}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        maxLength={MAX_PASSWORD_LENGTH}
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
      <Button type="submit" pending={pending}>
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
