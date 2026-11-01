'use client';

import { useActionState } from 'react';
import { Banner } from '../../components/ui/banner.tsx';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.tsx';
import { texts } from '../../lib/texts.ts';
import { type CodeFormState, type CodeListPage, removeCode } from './actions.ts';

const c = texts.codes;

/** Deletes a code from a list, behind a confirmation that names it (`code`, as shown). */
export function DeleteCodeForm({ id, code, back }: { id: string; code: string; back: CodeListPage }) {
  const [state, action, pending] = useActionState(removeCode.bind(null, id, back), {} as CodeFormState);
  return (
    <form action={action} className="inline-grid justify-items-end gap-2">
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      <ConfirmDialog
        trigger={c.delete}
        triggerSize="sm"
        title={c.deleteTitle}
        cancel={c.cancel}
        confirm={c.delete}
        name="delete"
        value="1"
        pending={pending}
      >
        <p>{c.deleteText(code)}</p>
      </ConfirmDialog>
    </form>
  );
}
