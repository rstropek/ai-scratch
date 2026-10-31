'use client';

import { useActionState } from 'react';
import { Banner } from '../../../../components/ui/banner.tsx';
import { Button } from '../../../../components/ui/button.tsx';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog.tsx';
import { texts } from '../../../../lib/texts.ts';
import { type DecideState, switchBudget } from './actions.ts';

const a = texts.admin.account;

/** Switches the free budget on (any account, with a mail), or off behind a confirmation (no mail). */
export function BudgetForm({ userId, on, name }: { userId: string; on: boolean; name: string }) {
  const [state, action, pending] = useActionState(switchBudget.bind(null, userId), {} as DecideState);
  return (
    <form action={action} className="grid justify-items-start gap-3">
      {state.error && <Banner tone="error">{state.error}</Banner>}
      {on ? (
        <ConfirmDialog
          trigger={a.switchOff}
          title={a.switchOffTitle}
          cancel={a.cancel}
          confirm={a.switchOff}
          name="budget"
          value="off"
          pending={pending}
        >
          <p>{a.switchOffText(name)}</p>
        </ConfirmDialog>
      ) : (
        <>
          <p className="text-sm">{a.switchOnHint(name)}</p>
          <Button type="submit" name="budget" value="on" pending={pending}>
            {a.switchOn}
          </Button>
        </>
      )}
    </form>
  );
}
