import { type ComponentProps, type ReactNode, useId } from 'react';
import { cx } from './cx.ts';
import { FieldError } from './field-error.tsx';

/** The look of text inputs and text areas: border, focus halo, error edge. */
export const fieldClass = (invalid: boolean) =>
  cx(
    'w-full rounded-field border bg-surface text-base text-foreground placeholder:text-muted',
    'transition-[border-color,box-shadow] duration-150 ease-out hover:border-border-strong',
    'focus:border-primary focus:focus-ring disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted',
    invalid ? 'border-error-edge hover:border-error-edge focus:border-error-edge' : 'border-border',
  );

type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: ReactNode;
  /** shown under the label, before the field */
  hint?: ReactNode;
  /** what is wrong and what to do; marks the field invalid */
  error?: string;
};

/** A labelled text input with an optional hint and error, linked for screen readers. */
export function TextField({ label, hint, error, className, ...props }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="font-bold text-sm">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        className={cx('h-10 px-3', fieldClass(Boolean(error)))}
        {...props}
      />
      {error && errorId && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
