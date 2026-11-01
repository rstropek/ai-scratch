import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '../../../components/ui/button.tsx';
import { texts } from '../../../lib/texts.ts';

export function BackLink() {
  return (
    <Link href="/admin/keys" className={buttonClass('quiet', 'sm')}>
      <ArrowLeft aria-hidden />
      {texts.admin.keys.back}
    </Link>
  );
}
