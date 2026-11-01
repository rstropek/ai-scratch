import type { Metadata } from 'next';
import { NotAdmin } from '../../../components/admin-gate.tsx';
import { AppShell } from '../../../components/app-shell.tsx';
import { Banner } from '../../../components/ui/banner.tsx';
import { PageHeader } from '../../../components/ui/page-header.tsx';
import { getPrice } from '../../../lib/prices.ts';
import { getDb } from '../../../lib/services.ts';
import { requireAdmin } from '../../../lib/session.ts';
import { texts } from '../../../lib/texts.ts';
import { PriceForm } from './price-form.tsx';

export const metadata: Metadata = { title: texts.admin.prices.title };

const p = texts.admin.prices;

export default async function PricesPage({ searchParams }: PageProps<'/admin/prices'>) {
  const { session, allowed } = await requireAdmin();
  const { user } = session;
  if (!allowed)
    return (
      <AppShell userName={user.name}>
        <NotAdmin name={user.name} />
      </AppShell>
    );
  const { saved } = await searchParams;
  const { updatedAt, updatedBy, ...price } = await getPrice(getDb());
  return (
    <AppShell userName={user.name} admin>
      <PageHeader title={p.title} description={p.description} />
      {saved === '1' && <Banner tone="success">{p.saved}</Banner>}
      <div className="grid max-w-2xl gap-3">
        <PriceForm stored={price} />
        <p className="text-muted text-xs">{p.updated(updatedAt, updatedBy)}</p>
      </div>
    </AppShell>
  );
}
