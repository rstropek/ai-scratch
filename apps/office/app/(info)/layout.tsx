import Link from 'next/link';
import { SiteFooter } from '../../components/site-footer.tsx';
import { buttonClass } from '../../components/ui/button.tsx';
import { TopBar } from '../../components/ui/top-bar.tsx';
import { texts } from '../../lib/texts.ts';

/** The public info pages: no login, static, rendered at build time. */
export default function InfoLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <TopBar>
        <Link href="/login" className={buttonClass('on-bar', 'sm')}>
          {texts.shell.signIn}
        </Link>
      </TopBar>
      {/* wide enough for /access; text pages narrow themselves */}
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6">{children}</main>
      <SiteFooter />
    </>
  );
}
