'use client';

import { useActionState } from 'react';
import { Banner } from '../../../components/ui/banner.tsx';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog.tsx';
import { texts } from '../../../lib/texts.ts';
import { type KeyFormState, removeKey } from './actions.ts';

const k = texts.admin.keys;

/** Deletes a key or federation from the pool, behind a confirmation that says what happens (`text`). */
export function DeleteForm({ id, text }: { id: string; text: string }) {
  const [state, action, pending] = useActionState(removeKey.bind(null, id), {} as KeyFormState);
  return (
    <form action={action} className="grid justify-items-start gap-3">
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      <p className="text-sm">{k.deleteHint}</p>
      <ConfirmDialog
        trigger={k.delete}
        title={k.deleteTitle}
        cancel={k.cancel}
        confirm={k.delete}
        name="delete"
        value="1"
        pending={pending}
      >
        <p>{text}</p>
      </ConfirmDialog>
    </form>
  );
}
