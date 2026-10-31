import Image from 'next/image';
import type { ReactNode } from 'react';
import { texts } from '../../lib/texts.ts';

/** Scratch's purple menu bar with the logo and the office's name; children go to the right end. */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-4">
        <Image
          src="/icon.svg"
          alt=""
          width={28}
          height={28}
          unoptimized
          className="size-7 rounded-button bg-white/95 p-0.5"
        />
        <span className="whitespace-nowrap font-bold">{texts.appName}</span>
        {children && <div className="ml-auto flex min-w-0 items-center gap-2 text-sm">{children}</div>}
      </div>
    </header>
  );
}
