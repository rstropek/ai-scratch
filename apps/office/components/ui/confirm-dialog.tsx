'use client';

import { X } from 'lucide-react';
import { type ReactNode, useId, useRef } from 'react';
import { Button, type ButtonVariant } from './button.tsx';

type ConfirmDialogProps = {
  /** the button that opens the dialog */
  trigger: string;
  triggerVariant?: ButtonVariant;
  title: string;
  children: ReactNode;
  cancel: string;
  /** names the action, never "OK" */
  confirm: string;
  /** the confirm button submits the surrounding form with this name and value */
  name: string;
  value: string;
  pending?: boolean;
};

/**
 * Scratch's modal for a destructive step (rejecting an application): purple header, focus on "Abbrechen". Placed
 * inside a form, so the confirm button submits it.
 */
export function ConfirmDialog({
  trigger,
  triggerVariant = 'danger',
  title,
  children,
  cancel,
  confirm,
  name,
  value,
  pending,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => ref.current?.close();
  return (
    <>
      <Button variant={triggerVariant} pending={pending} onClick={() => ref.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-[min(100%-2rem,26rem)] overflow-hidden rounded-panel bg-surface p-0 text-foreground shadow-[0_0_0_4px_hsla(0,0%,100%,0.25)] backdrop:bg-overlay"
      >
        <header className="grid h-12 grid-cols-[2rem_1fr_2rem] items-center bg-primary px-2 text-white">
          <span />
          <h2 id={titleId} className="text-center font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label={cancel}
            onClick={close}
            className="grid size-8 place-items-center rounded-button hover:bg-white/15 focus-visible:focus-ring"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="grid gap-4 p-5">
          <div className="text-base">{children}</div>
          <div className="flex flex-wrap justify-end gap-2.5">
            <Button variant="secondary" autoFocus onClick={close}>
              {cancel}
            </Button>
            <Button variant="danger" type="submit" name={name} value={value} onClick={close}>
              {confirm}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
