'use client';

import { useActionState } from 'react';
import { Banner } from '../../components/ui/banner.tsx';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.tsx';
import { texts } from '../../lib/texts.ts';
import { type OpenRouterKeyFormState, removeKey } from './actions.ts';

const o = texts.openrouterKeys;

/** Deletes an own key behind a confirmation that names the codes going with it (`codes`, as shown). */
export function DeleteKeyForm({ id, name, codes }: { id: string; name: string; codes: string[] }) {
  const [state, action, pending] = useActionState(removeKey.bind(null, id), {} as OpenRouterKeyFormState);
  return (
    <form action={action} className="inline-grid justify-items-end gap-2">
      {state.banner && (
        <Banner tone="error" title={state.banner.title}>
          {state.banner.text}
        </Banner>
      )}
      <ConfirmDialog
        trigger={o.delete}
        triggerSize="sm"
        title={o.deleteTitle}
        cancel={o.cancel}
        confirm={o.delete}
        name="delete"
        value="1"
        pending={pending}
      >
        <p>{name}</p>
        {codes.length > 0 && <p className="mt-2">{o.deleteCodes(codes)}</p>}
      </ConfirmDialog>
    </form>
  );
}
