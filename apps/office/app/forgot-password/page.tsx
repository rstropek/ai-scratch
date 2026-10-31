import type { Metadata } from 'next';
import { PublicShell } from '../../components/public-shell.tsx';
import { texts } from '../../lib/texts.ts';
import { ForgotForm } from './forgot-form.tsx';

export const metadata: Metadata = { title: texts.forgot.title };

export default function ForgotPasswordPage() {
  return (
    <PublicShell>
      <ForgotForm />
    </PublicShell>
  );
}
