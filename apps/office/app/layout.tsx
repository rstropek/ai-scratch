import type { Metadata } from 'next';
import { texts } from '../lib/texts.ts';
import './globals.css';

export const metadata: Metadata = {
  title: texts.appName,
  robots: { index: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="de">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
