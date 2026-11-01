import type { Metadata } from 'next';
import { Callout } from '../../../components/ui/callout.tsx';
import { PageHeader } from '../../../components/ui/page-header.tsx';
import { Panel } from '../../../components/ui/panel.tsx';
import { Prose } from '../../../components/ui/prose.tsx';
import { TermsDocument, terms } from '../../../content/terms.tsx';

export const metadata: Metadata = { title: terms.title };

export default function TermsPage() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={terms.title} description={terms.date} />
      <Panel className="grid gap-6">
        <Callout title={terms.keyPointsTitle}>
          <Prose>
            <ul>
              {terms.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Prose>
        </Callout>
        <Prose>
          <TermsDocument />
        </Prose>
      </Panel>
    </div>
  );
}
