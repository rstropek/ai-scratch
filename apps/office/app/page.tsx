import { AppShell } from '../components/app-shell.tsx';
import { Chip } from '../components/ui/chip.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { requireSession } from '../lib/session.ts';
import { texts } from '../lib/texts.ts';

export default async function Home() {
  const { user } = await requireSession();
  return (
    <AppShell userName={user.name}>
      <PageHeader
        title={texts.home.greeting(user.name)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {texts.home.signedInAs(user.email)}
            {user.role === 'admin' && <Chip tone="primary">{texts.home.admin}</Chip>}
          </span>
        }
      />
    </AppShell>
  );
}
