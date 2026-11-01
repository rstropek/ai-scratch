'use client';

import { Banner } from '../../../components/ui/banner.tsx';
import { Checkbox } from '../../../components/ui/checkbox.tsx';
import { TextField } from '../../../components/ui/text-field.tsx';
import type { KeyRow } from '../../../lib/anthropic-keys.ts';
import { answerOf } from '../../../lib/form-state.ts';
import { DONOR_MAX, KEY_CAP_MAX_USD, KEY_PRIORITY_MAX } from '../../../lib/rules.ts';
import { texts } from '../../../lib/texts.ts';
import type { KeyFormState } from './actions.ts';

const f = texts.admin.keys.form;

/** after an answer the fields show what was sent; before it, the stored values */
export const formValue = (state: KeyFormState) => (name: string, initial: string) =>
  state.values ? answerOf(state, name) : initial;

/** what went wrong with the whole form, above the fields */
export function FormBanners({ state }: { state: KeyFormState }) {
  const errorCount = Object.keys(state.fieldErrors ?? {}).length;
  return (
    <>
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      {errorCount > 1 && <Banner tone="error" title={texts.validation.summary(errorCount)} />}
    </>
  );
}

export function DonorField({ state, stored }: { state: KeyFormState; stored?: KeyRow }) {
  return (
    <TextField
      label={f.donor}
      hint={f.donorHint}
      name="donor"
      maxLength={DONOR_MAX}
      required
      defaultValue={formValue(state)('donor', stored?.donor ?? '')}
      error={state.fieldErrors?.donor}
    />
  );
}

/** how the pool uses an entry, the same for keys and federations: limit, priority, pausing */
export function PoolFields({ state, stored }: { state: KeyFormState; stored?: KeyRow }) {
  const errors = state.fieldErrors ?? {};
  const value = formValue(state);
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={f.capMonth}
          hint={f.capMonthHint}
          name="capMonth"
          inputMode="numeric"
          type="number"
          min={1}
          max={KEY_CAP_MAX_USD}
          required
          defaultValue={value('capMonth', stored ? String(stored.capMonth) : '')}
          error={errors.capMonth}
        />
        <TextField
          label={f.priority}
          hint={f.priorityHint}
          name="priority"
          inputMode="numeric"
          type="number"
          min={0}
          max={KEY_PRIORITY_MAX}
          required
          defaultValue={value('priority', String(stored?.priority ?? 0))}
          error={errors.priority}
        />
      </div>
      <Checkbox
        label={f.active}
        name="active"
        defaultChecked={state.values ? answerOf(state, 'active') === 'true' : (stored?.active ?? true)}
      />
    </>
  );
}
