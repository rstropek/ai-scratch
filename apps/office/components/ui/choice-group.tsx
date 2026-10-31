import { type ReactNode, useId } from 'react';
import { cx } from './cx.ts';
import { FieldError } from './field-error.tsx';

type ChoiceGroupProps = {
  legend: ReactNode;
  /** radio: exactly one; checkbox: any number */
  type: 'radio' | 'checkbox';
  name: string;
  options: readonly { value: string; label: ReactNode }[];
  defaultValue?: readonly string[];
  /** stack: one per line (longer labels); pills: side by side, the chosen ones filled */
  layout?: 'stack' | 'pills';
  required?: boolean;
  error?: string;
  className?: string;
};

/** A fieldset of radios or checkboxes with a legend and an optional error. */
export function ChoiceGroup({
  legend,
  type,
  name,
  options,
  defaultValue = [],
  layout = 'stack',
  required,
  error,
  className,
}: ChoiceGroupProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset
      aria-describedby={errorId}
      aria-invalid={error ? true : undefined}
      className={cx('grid min-w-0 gap-2', className)}
    >
      <legend className="mb-2 font-bold text-sm">{legend}</legend>
      <div className={layout === 'pills' ? 'flex flex-wrap gap-2' : 'grid gap-2'}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              'flex cursor-pointer items-start gap-2.5',
              layout === 'pills' &&
                [
                  'items-center rounded-field border bg-surface px-3 py-2 text-sm',
                  'has-checked:border-primary has-checked:bg-primary-light has-checked:font-bold has-checked:text-primary-ink',
                  'has-focus-visible:focus-ring',
                  error ? 'border-error-edge' : 'border-border',
                ].join(' '),
            )}
          >
            <input
              type={type}
              name={name}
              value={option.value}
              defaultChecked={defaultValue.includes(option.value)}
              // a required radio group needs one choice; checkbox groups are checked on the server
              required={type === 'radio' && required}
              className={cx(
                'size-4.5 shrink-0 accent-primary',
                layout === 'stack' && 'mt-0.5 focus-visible:focus-ring',
              )}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && errorId && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  );
}
