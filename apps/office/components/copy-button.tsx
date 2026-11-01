'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { texts } from '../lib/texts.ts';
import { Button } from './ui/button.tsx';

const SHOWN_MS = 2000;

/** Copies `value` to the clipboard; the icon turns into a check for a moment, and screen readers hear the outcome. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [outcome, setOutcome] = useState<'copied' | 'failed'>();
  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(() => setOutcome(undefined), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [outcome]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setOutcome('copied');
    } catch {
      setOutcome('failed');
    }
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button variant="quiet" size="sm" aria-label={label} title={label} onClick={copy}>
        {outcome === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
      </Button>
      <span role="status" className="text-muted text-xs">
        {outcome && texts.copy[outcome]}
      </span>
    </span>
  );
}
