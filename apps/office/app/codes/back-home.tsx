import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '../../components/ui/button.tsx';
import { texts } from '../../lib/texts.ts';

export function BackHome() {
  return (
    <Link href="/" className={buttonClass('quiet', 'sm')}>
      <ArrowLeft aria-hidden />
      {texts.codes.back}
    </Link>
  );
}
