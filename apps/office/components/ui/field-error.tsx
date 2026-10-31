import { CircleAlert } from 'lucide-react';

/** What is wrong with a field and what to do; the field points at it with aria-describedby. */
export function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="flex items-start gap-1.5 font-bold text-error-ink text-xs">
      <CircleAlert aria-hidden className="mt-px size-3.75 shrink-0" />
      {children}
    </p>
  );
}
