import { type ComponentProps, type ReactNode, useId } from 'react';
import { cx } from './cx.ts';
import { FieldError } from './field-error.tsx';

type CheckboxProps = Omit<ComponentProps<'input'>, 'id' | 'type'> & {
  label: ReactNode;
  /** what is missing; marks the box invalid */
  error?: string;
};

/** One checkbox with its label (a consent, a yes/no), and an optional error under it. */
export function Checkbox({ label, error, className, ...props }: CheckboxProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx('grid gap-1.5', className)}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cx(
            'mt-0.5 size-4.5 shrink-0 accent-primary focus-visible:focus-ring',
            error && 'outline-2 outline-error-edge outline-offset-1',
          )}
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && errorId && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
