'use client';

import { useActionState } from 'react';
import { Banner } from '../../components/ui/banner.tsx';
import { Button } from '../../components/ui/button.tsx';
import { TextField } from '../../components/ui/text-field.tsx';
import { answerOf } from '../../lib/form-state.ts';
import { OPENROUTER_LABEL_MAX } from '../../lib/rules.ts';
import { texts } from '../../lib/texts.ts';
import { addKey, type OpenRouterKeyFormState } from './actions.ts';

const o = texts.openrouterKeys;

export function AddKeyForm() {
  const [state, action, pending] = useActionState(addKey, {} as OpenRouterKeyFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="grid gap-5">
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      <TextField
        label={o.label}
        hint={o.labelHint}
        name="label"
        maxLength={OPENROUTER_LABEL_MAX}
        required
        defaultValue={answerOf(state, 'label')}
        error={errors.label}
      />
      <TextField
        label={o.key}
        hint={o.keyHint}
        name="key"
        type="password"
        // browsers ignore "off" on password fields and would fill in the account's own password
        autoComplete="new-password"
        data-1p-ignore
        data-lpignore="true"
        spellCheck={false}
        required
        error={errors.key}
      />
      <p className="text-muted text-xs">{o.checkNote}</p>
      <div>
        <Button type="submit" pending={pending}>
          {o.add}
        </Button>
      </div>
    </form>
  );
}
