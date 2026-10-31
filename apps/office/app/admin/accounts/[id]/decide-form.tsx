'use client';

import { useActionState } from 'react';
import { Banner } from '../../../../components/ui/banner.tsx';
import { Button } from '../../../../components/ui/button.tsx';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog.tsx';
import { TextArea } from '../../../../components/ui/text-area.tsx';
import { texts } from '../../../../lib/texts.ts';
import { type DecideState, decide } from './actions.ts';

const a = texts.admin.account;

/** Annehmen, or Ablehnen behind a confirmation; an optional internal note for both. */
export function DecideForm({ userId, applicationId, name }: { userId: string; applicationId: string; name: string }) {
  const [state, action, pending] = useActionState(decide.bind(null, userId, applicationId), {} as DecideState);
  return (
    <form action={action} className="grid gap-4">
      {state.error && <Banner tone="error">{state.error}</Banner>}
      <TextArea label={a.note} hint={a.noteHint} name="note" maxLength={1000} rows={2} />
      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" name="decision" value="accepted" pending={pending}>
          {a.accept}
        </Button>
        <ConfirmDialog
          trigger={a.reject}
          title={a.rejectTitle}
          cancel={a.cancel}
          confirm={a.reject}
          name="decision"
          value="rejected"
          pending={pending}
        >
          <p>{a.rejectText(name)}</p>
        </ConfirmDialog>
      </div>
    </form>
  );
}
