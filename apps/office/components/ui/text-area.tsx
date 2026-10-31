'use client';

import { type ComponentProps, type ReactNode, useId, useState } from 'react';
import { cx } from './cx.ts';
import { FieldError } from './field-error.tsx';
import { fieldClass } from './text-field.tsx';

type TextAreaProps = Omit<ComponentProps<'textarea'>, 'id'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** shows "n / max" under the field and limits the input */
  maxLength: number;
};

/** A labelled multi-line field with a character counter, an optional hint and error, linked for screen readers. */
export function TextArea({
  label,
  hint,
  error,
  maxLength,
  className,
  defaultValue,
  onChange,
  ...props
}: TextAreaProps) {
  const id = useId();
  const [length, setLength] = useState(String(defaultValue ?? '').length);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const countId = `${id}-count`;
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
      <textarea
        id={id}
        rows={4}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId, countId)}
        className={cx('min-h-24 resize-y px-3 py-2', fieldClass(Boolean(error)))}
        onChange={(event) => {
          setLength(event.currentTarget.value.length);
          onChange?.(event);
        }}
        {...props}
      />
      <p id={countId} className="justify-self-end text-muted text-xs tabular-nums">
        {length} / {maxLength}
      </p>
      {error && errorId && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
