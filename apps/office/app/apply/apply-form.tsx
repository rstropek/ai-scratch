'use client';

import { useActionState } from 'react';
import { Banner } from '../../components/ui/banner.tsx';
import { Button } from '../../components/ui/button.tsx';
import { ChoiceGroup } from '../../components/ui/choice-group.tsx';
import { FormGroup } from '../../components/ui/form-group.tsx';
import { TextArea } from '../../components/ui/text-area.tsx';
import { TextField } from '../../components/ui/text-field.tsx';
import { answerOf, answersOf } from '../../lib/form-state.ts';
import { SCHOOL_NAME_MAX, SCHOOL_URL_MAX, SUMMARY_MAX } from '../../lib/rules.ts';
import { GRADES, texts } from '../../lib/texts.ts';
import { type ApplyState, apply } from './actions.ts';

const t = texts.apply;
const gradeOptions = Object.entries(GRADES).map(([value, label]) => ({ value, label }));

export function ApplyForm() {
  const [state, action, pending] = useActionState(apply, {} as ApplyState);
  const errors = state.fieldErrors ?? {};
  const errorCount = Object.keys(errors).length;
  return (
    <form action={action} noValidate className="grid gap-5 rounded-panel border border-divider bg-surface p-6">
      {state.refused && (
        <Banner tone="error" title={t.refusedTitle}>
          <ul className="grid gap-1">
            {state.refused.map((reason) => (
              <li key={reason}>{t.refusals[reason]}</li>
            ))}
          </ul>
        </Banner>
      )}
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      {errorCount > 1 && <Banner tone="error" title={texts.validation.summary(errorCount)} />}
      <FormGroup title={t.school}>
        <TextField
          label={t.schoolName}
          name="schoolName"
          autoComplete="organization"
          maxLength={SCHOOL_NAME_MAX}
          required
          defaultValue={answerOf(state, 'schoolName')}
          error={errors.schoolName}
        />
        <TextField
          label={t.schoolUrl}
          hint={t.schoolUrlHint}
          name="schoolUrl"
          inputMode="url"
          maxLength={SCHOOL_URL_MAX}
          placeholder="www.ms-lindenweg.at"
          required
          defaultValue={answerOf(state, 'schoolUrl')}
          error={errors.schoolUrl}
        />
        <ChoiceGroup
          legend={t.grades}
          type="checkbox"
          name="grades"
          layout="pills"
          options={gradeOptions}
          defaultValue={answersOf(state, 'grades')}
          error={errors.grades}
        />
      </FormGroup>
      <FormGroup title={t.plan}>
        <TextArea
          // a new key after each answer: the counter starts from the text that comes back
          key={state.values ? JSON.stringify(state.values.summary) : 'new'}
          label={t.summary}
          hint={t.summaryHint}
          name="summary"
          maxLength={SUMMARY_MAX}
          required
          defaultValue={answerOf(state, 'summary')}
          error={errors.summary}
        />
      </FormGroup>
      <Button type="submit" pending={pending} className="justify-self-start">
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
