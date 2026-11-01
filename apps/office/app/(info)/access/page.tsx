import type { Metadata } from 'next';
import { AccessTour } from '../../../components/access-tour.tsx';
import { PageHeader } from '../../../components/ui/page-header.tsx';
import { Panel } from '../../../components/ui/panel.tsx';
import { Prose } from '../../../components/ui/prose.tsx';
import { Section } from '../../../components/ui/section.tsx';
import { Cell, Table, TableFooter } from '../../../components/ui/table.tsx';
import { access, TechDocument, WhySecure } from '../../../content/access.tsx';

export const metadata: Metadata = { title: access.title };

const { who, limits } = access;

export default function AccessPage() {
  return (
    <>
      <PageHeader title={access.title} description={access.description} />
      <AccessTour />
      <Section title={who.title} className="mt-4">
        <Panel padded={false}>
          <Table
            stack
            columns={[{ label: who.columns.who }, { label: who.columns.creates }, { label: who.columns.neverSees }]}
          >
            {who.rows.map((row) => (
              <tr key={row.who}>
                <Cell>
                  <span className="font-bold">{row.who}</span>
                </Cell>
                <Cell label={who.columns.creates}>{row.creates}</Cell>
                <Cell label={who.columns.neverSees}>{row.neverSees}</Cell>
              </tr>
            ))}
          </Table>
        </Panel>
      </Section>
      <Section title={limits.title} className="mt-4">
        <Panel padded={false}>
          <Table
            stack
            columns={[
              { label: limits.columns.limit },
              { label: limits.columns.value },
              { label: limits.columns.appliesTo },
            ]}
          >
            {limits.rows.map((row) => (
              <tr key={row.limit}>
                <Cell>
                  <span className="font-bold">{row.limit}</span>
                </Cell>
                <Cell label={limits.columns.value}>
                  <span className="tabular-nums">{row.value}</span>
                </Cell>
                <Cell label={limits.columns.appliesTo}>{row.appliesTo}</Cell>
              </tr>
            ))}
          </Table>
          <TableFooter>{limits.footer}</TableFooter>
        </Panel>
      </Section>
      <Section title={access.whyTitle} className="mt-4">
        <Panel>
          <Prose>
            <WhySecure />
          </Prose>
        </Panel>
      </Section>
      <Section title={access.techTitle} className="mt-4">
        <Panel className="grid gap-5">
          <TechDocument />
        </Panel>
      </Section>
    </>
  );
}
