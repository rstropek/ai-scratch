'use client';

import { useActionState } from 'react';
import { ConsentFields } from '../../components/consent-fields.tsx';
import { Banner } from '../../components/ui/banner.tsx';
import { Button } from '../../components/ui/button.tsx';
import { answerOf } from '../../lib/form-state.ts';
import { texts } from '../../lib/texts.ts';
import { type ConsentState, consent } from './actions.ts';

export function ConsentForm() {
  const [state, action, pending] = useActionState(consent, {} as ConsentState);
  return (
    <form action={action} noValidate className="grid gap-4">
      {state.banner && <Banner tone="error" title={state.banner.title} />}
      <ConsentFields checked={(name) => answerOf(state, name) === 'on'} errors={state.fieldErrors ?? {}} />
      <Button type="submit" pending={pending} className="justify-self-start">
        {pending ? texts.consent.submitting : texts.consent.submit}
      </Button>
    </form>
  );
}
