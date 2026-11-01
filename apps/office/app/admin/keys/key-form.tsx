'use client';

import { useActionState } from 'react';
import { Button } from '../../../components/ui/button.tsx';
import { TextField } from '../../../components/ui/text-field.tsx';
import type { KeyRow } from '../../../lib/anthropic-keys.ts';
import { texts } from '../../../lib/texts.ts';
import { type KeyFormState, saveKey } from './actions.ts';
import { DonorField, FormBanners, formValue, PoolFields } from './entry-fields.tsx';

const f = texts.admin.keys.form;

/** Adds a key, or (with `stored`) edits one; the key field then only replaces the stored key. */
export function KeyForm({ stored }: { stored?: KeyRow }) {
  const [state, action, pending] = useActionState(saveKey.bind(null, stored?.id), {} as KeyFormState);
  const errors = state.fieldErrors ?? {};
  const value = formValue(state);
  return (
    <form action={action} noValidate className="grid gap-5 rounded-panel border border-divider bg-surface p-6">
      <FormBanners state={state} />
      <DonorField state={state} stored={stored} />
      <TextField
        label={stored ? f.keyReplace : f.key}
        hint={stored ? f.keyReplaceHint(stored.keyHint ?? '') : f.keyHint}
        name="key"
        type="password"
        // browsers ignore "off" on password fields and would fill in the admin's own password
        autoComplete="new-password"
        data-1p-ignore
        data-lpignore="true"
        spellCheck={false}
        required={!stored}
        error={errors.key}
      />
      <TextField
        label={f.workspaceId}
        hint={f.workspaceIdHint}
        name="workspaceId"
        autoComplete="off"
        spellCheck={false}
        defaultValue={value('workspaceId', stored?.workspaceId ?? '')}
        error={errors.workspaceId}
      />
      <PoolFields state={state} stored={stored} />
      <p className="text-muted text-xs">{f.checkNote}</p>
      <div>
        <Button type="submit" pending={pending}>
          {stored ? f.save : f.add}
        </Button>
      </div>
    </form>
  );
}
