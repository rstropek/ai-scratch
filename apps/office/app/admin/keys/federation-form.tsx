'use client';

import { useActionState } from 'react';
import { Button } from '../../../components/ui/button.tsx';
import { TextField } from '../../../components/ui/text-field.tsx';
import type { KeyRow } from '../../../lib/anthropic-keys.ts';
import { texts } from '../../../lib/texts.ts';
import { type KeyFormState, saveFederation } from './actions.ts';
import { DonorField, FormBanners, formValue, PoolFields } from './entry-fields.tsx';

const f = texts.admin.keys.form;

/** Adds a federation, or (with `stored`) edits one: the IDs of the donor's federation rule, none of them secret. */
export function FederationForm({ stored }: { stored?: KeyRow }) {
  const [state, action, pending] = useActionState(saveFederation.bind(null, stored?.id), {} as KeyFormState);
  const errors = state.fieldErrors ?? {};
  const value = formValue(state);
  const idField = (name: 'organizationId' | 'federationRuleId' | 'serviceAccountId' | 'workspaceId') => ({
    name,
    autoComplete: 'off',
    spellCheck: false,
    defaultValue: value(name, stored?.[name] ?? ''),
    error: errors[name],
  });
  return (
    <form action={action} noValidate className="grid gap-5 rounded-panel border border-divider bg-surface p-6">
      <FormBanners state={state} />
      <p className="text-sm">{f.federationIntro}</p>
      <DonorField state={state} stored={stored} />
      <TextField label={f.organizationId} hint={f.organizationIdHint} required {...idField('organizationId')} />
      <TextField label={f.federationRuleId} hint={f.federationRuleIdHint} required {...idField('federationRuleId')} />
      <TextField label={f.serviceAccountId} hint={f.serviceAccountIdHint} {...idField('serviceAccountId')} />
      <TextField label={f.workspaceId} hint={f.federationWorkspaceIdHint} {...idField('workspaceId')} />
      <PoolFields state={state} stored={stored} />
      <p className="text-muted text-xs">{f.federationCheckNote}</p>
      <div>
        <Button type="submit" pending={pending}>
          {stored ? f.save : f.add}
        </Button>
      </div>
    </form>
  );
}
