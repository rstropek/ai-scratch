import type { ReactNode } from 'react';

/** A topic inside a form ("Ihre Schule", "Zustimmung"): a heading, then its fields; a rule between groups. */
export function FormGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-divider border-b pb-6 last-of-type:border-b-0 last-of-type:pb-0">
      <h2 className="font-bold text-lg">{title}</h2>
      {children}
    </section>
  );
}
