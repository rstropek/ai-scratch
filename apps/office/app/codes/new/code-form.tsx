'use client';

import { CODE_COMMENT_MAX, CODE_START_MAX_DAYS } from '@ai-scratch/db/limits';
import { RefreshCw } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';
import { Banner } from '../../../components/ui/banner.tsx';
import { Button } from '../../../components/ui/button.tsx';
import { Checkbox } from '../../../components/ui/checkbox.tsx';
import { ChoiceGroup } from '../../../components/ui/choice-group.tsx';
import { TextArea } from '../../../components/ui/text-area.tsx';
import { TextField } from '../../../components/ui/text-field.tsx';
import { answerOf } from '../../../lib/form-state.ts';
import { texts } from '../../../lib/texts.ts';
import { type CodeFormState, proposeCode, saveCode } from '../actions.ts';

const c = texts.codes;

/**
 * The new code: the generated proposal (another one on request), who pays, the window, a comment and "frage KI".
 * The code goes along as a hidden field; the server takes only codes it could have generated.
 */
export function CodeForm({
  proposal,
  sources,
  durations,
  codeBudgetUsd,
}: {
  proposal: string;
  sources: { value: string; label: string }[];
  durations: number[];
  codeBudgetUsd: number;
}) {
  const [code, setCode] = useState(proposal);
  const [state, action, pending] = useActionState(async (previous: CodeFormState, form: FormData) => {
    const next = await saveCode(previous, form);
    // a code that was taken in the meantime comes back with a fresh proposal
    const answered = next.values?.code;
    if (typeof answered === 'string' && answered) setCode(answered);
    return next;
  }, {} as CodeFormState);
  const [drawing, startDrawing] = useTransition();
  const errors = state.fieldErrors ?? {};
  const value = (name: string, initial: string) => (state.values ? answerOf(state, name) : initial);
  const errorCount = Object.keys(errors).length;
  return (
    <form action={action} noValidate className="grid gap-5 rounded-panel border border-divider bg-surface p-6">
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      {errorCount > 1 && <Banner tone="error" title={texts.validation.summary(errorCount)} />}
      <div className="grid gap-1.5">
        <p className="font-bold text-sm">{c.code}</p>
        <p className="text-muted text-xs">{c.codeHint}</p>
        <div className="flex flex-wrap items-center gap-3">
          {/* shown as kids type it; stored lowercase */}
          <output aria-live="polite" className="font-bold font-mono text-2xl">
            {code.toUpperCase()}
          </output>
          <Button
            variant="secondary"
            size="sm"
            pending={drawing}
            onClick={() => startDrawing(async () => setCode(await proposeCode()))}
          >
            <RefreshCw aria-hidden />
            {c.propose}
          </Button>
        </div>
        <input type="hidden" name="code" value={code} />
      </div>
      <ChoiceGroup
        legend={c.source}
        type="radio"
        name="source"
        options={sources}
        defaultValue={[value('source', sources[0]?.value ?? '')]}
        required
        error={errors.source}
      />
      <TextField
        label={c.startsAt}
        hint={c.startsAtHint(CODE_START_MAX_DAYS)}
        name="startsAt"
        type="datetime-local"
        defaultValue={value('startsAt', '')}
        error={errors.startsAt}
        className="sm:max-w-xs"
      />
      <ChoiceGroup
        legend={c.hours}
        type="radio"
        name="hours"
        layout="pills"
        options={durations.map((hours) => ({ value: String(hours), label: c.hoursLabel(hours) }))}
        defaultValue={[value('hours', '1')]}
        required
        error={errors.hours}
      />
      <TextArea
        label={c.comment}
        hint={c.commentHint}
        name="comment"
        maxLength={CODE_COMMENT_MAX}
        rows={2}
        defaultValue={value('comment', '')}
        error={errors.comment}
      />
      <Checkbox
        label={c.askEnabled}
        name="askEnabled"
        defaultChecked={state.values ? answerOf(state, 'askEnabled') === 'true' : true}
      />
      <p className="text-muted text-xs">{c.budgetNote(codeBudgetUsd)}</p>
      <div>
        <Button type="submit" pending={pending}>
          {c.submit}
        </Button>
      </div>
    </form>
  );
}
