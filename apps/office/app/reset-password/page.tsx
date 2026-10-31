import type { Metadata } from 'next';
import { PublicShell } from '../../components/public-shell.tsx';
import { texts } from '../../lib/texts.ts';
import { LinkInvalid } from './link-invalid.tsx';
import { ResetForm } from './reset-form.tsx';

export const metadata: Metadata = { title: texts.reset.title };

/** better-auth's link (/api/auth/reset-password/<token>) redirects here with ?token=, or with ?error=INVALID_TOKEN. */
export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const { token } = await searchParams;
  return (
    <PublicShell>{typeof token === 'string' && token ? <ResetForm token={token} /> : <LinkInvalid />}</PublicShell>
  );
}
