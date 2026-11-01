'use client';

import { Download } from 'lucide-react';
import { useActionState } from 'react';
import { Banner } from '../../../components/ui/banner.tsx';
import { Button } from '../../../components/ui/button.tsx';
import { TextField } from '../../../components/ui/text-field.tsx';
import { answerOf } from '../../../lib/form-state.ts';
import type { PriceField } from '../../../lib/prices.ts';
import { texts } from '../../../lib/texts.ts';
import { type PriceFormState, priceAction } from './actions.ts';

const p = texts.admin.prices;

// prices.ts loads the database package, which a client component can't
const FIELDS = ['input', 'output', 'cacheWrite', 'cacheRead'] as const satisfies readonly PriceField[];

/** The four prices in dollars per million tokens; the stored ones until OpenRouter's or an answer replaces them. */
export function PriceForm({ stored }: { stored: Record<PriceField, number> }) {
  const [state, action, pending] = useActionState(priceAction, {} as PriceFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="grid gap-5 rounded-panel border border-divider bg-surface p-6">
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      {state.fetched && (
        <Banner tone="info" title={p.fetched.title}>
          {p.fetched.text}
        </Banner>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <TextField
            key={field}
            label={p[field]}
            hint={p.hint}
            name={field}
            inputMode="decimal"
            autoComplete="off"
            required
            defaultValue={state.values ? answerOf(state, field) : String(stored[field])}
            error={errors[field]}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" name="intent" value="save" pending={pending}>
          {p.save}
        </Button>
        <Button type="submit" name="intent" value="fetch" variant="secondary" disabled={pending}>
          <Download aria-hidden />
          {p.fetch}
        </Button>
      </div>
    </form>
  );
}
