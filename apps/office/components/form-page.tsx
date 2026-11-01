import type { ReactNode } from 'react';

/** A longer form with a short column beside it that says what happens next (registration, application). */
export function FormPage({
  title,
  intro,
  aboveSteps,
  steps,
  note,
  footer,
  children,
}: {
  title: string;
  intro: ReactNode;
  /** between the intro and the steps, such as who may register */
  aboveSteps?: ReactNode;
  steps: readonly string[];
  note?: ReactNode;
  /** under both columns, across their full width */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,16rem)_minmax(0,36rem)] md:justify-center">
      <aside className="grid content-start gap-4 text-sm">
        <h1 className="text-balance font-bold text-2xl text-primary-ink">{title}</h1>
        <p>{intro}</p>
        {aboveSteps}
        <ol className="grid list-decimal gap-2 pl-4.5 marker:font-bold marker:text-primary">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {note && <p>{note}</p>}
      </aside>
      {children}
      {footer && <div className="md:col-span-2">{footer}</div>}
    </div>
  );
}
