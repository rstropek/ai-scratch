'use client';

import { MailCheck } from 'lucide-react';
import { useActionState } from 'react';
import { ConsentFields } from '../../components/consent-fields.tsx';
import { Turnstile } from '../../components/turnstile.tsx';
import { Banner } from '../../components/ui/banner.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Checkbox } from '../../components/ui/checkbox.tsx';
import { ChoiceGroup } from '../../components/ui/choice-group.tsx';
import { FieldError } from '../../components/ui/field-error.tsx';
import { FormGroup } from '../../components/ui/form-group.tsx';
import { StatePanel } from '../../components/ui/state-panel.tsx';
import { TextField } from '../../components/ui/text-field.tsx';
import { answerOf } from '../../lib/form-state.ts';
import { texts } from '../../lib/texts.ts';
import { type RegisterState, register } from './actions.ts';

const t = texts.register;

export function RegisterForm({ siteKey }: { siteKey: string }) {
  const [state, action, pending] = useActionState(register, {} as RegisterState);
  const errors = state.fieldErrors ?? {};
  const checked = (name: string) => answerOf(state, name) === 'on';

  if (state.sent)
    return (
      <StatePanel icon={MailCheck} tone="success" title={t.sentTitle}>
        <p>{t.sent(state.sent)}</p>
        <p className="text-muted text-xs">{t.sentHint}</p>
      </StatePanel>
    );

  const errorCount = Object.keys(errors).length;
  return (
    <form action={action} noValidate className="grid gap-5 rounded-panel border border-divider bg-surface p-6">
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      {errorCount > 1 && <Banner tone="error" title={texts.validation.summary(errorCount)} />}
      <FormGroup title={t.about}>
        <TextField
          label={t.email}
          hint={t.emailHint}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={answerOf(state, 'email')}
          error={errors.email}
        />
        {/* the free budget is for teachers only: its checkbox shows while "Lehrkraft" is chosen (CSS, no state) */}
        <div className="group grid gap-4">
          <ChoiceGroup
            legend={t.kind}
            type="radio"
            name="kind"
            required
            options={[
              { value: 'teacher', label: t.kindLabels.teacher },
              { value: 'parent', label: t.kindLabels.parent },
            ]}
            defaultValue={[answerOf(state, 'kind')]}
            error={errors.kind}
          />
          <Checkbox
            name="freeBudget"
            label={
              <>
                {t.freeBudget}
                <span className="mt-1 block text-muted text-xs">{t.freeBudgetHint}</span>
              </>
            }
            defaultChecked={checked('freeBudget')}
            className="hidden rounded-field bg-primary-light p-3 group-has-[input[value=teacher]:checked]:grid"
          />
        </div>
      </FormGroup>
      <FormGroup title={t.consent}>
        <Checkbox name="adult" label={t.adult} defaultChecked={checked('adult')} error={errors.adult} />
        <ConsentFields checked={checked} errors={errors} />
        <div className="grid gap-1.5">
          <Turnstile siteKey={siteKey} resetKey={state.attempt} />
          <p className="text-muted text-xs">{t.turnstileHint}</p>
          {errors.turnstile && <FieldError id="turnstile-error">{errors.turnstile}</FieldError>}
        </div>
      </FormGroup>
      <Button type="submit" pending={pending} className="justify-self-start">
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
