// KI-Energie under the chat's top bar (rules in src/shared/energy.ts): the hearts (messages left, one
// refills every 20 s) and the Gedächtnis gauge (the context the AI reads, up to the limit). The gauge
// opens the two ways to free the memory, which the kid uses by hand.
import { Heart, LoaderCircle, NotebookPen, RotateCcw } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CONTEXT_LIMIT, HEARTS } from '../../shared/energy.ts';

export interface MemoryActionsProps {
  /** there is conversation to summarize */
  canCompact: boolean;
  /** there is conversation to delete */
  canClear: boolean;
  /** a turn is running or a summary is being written */
  busy: boolean;
  compacting: boolean;
  onCompact: () => void;
  onClear: () => void;
}

// scales with the chat font like the send button; a fixed h-8 would clip large text
const ACTION = 'h-auto py-1.5 text-[length:inherit] [&_svg]:size-[1.1em]';

/** "Zusammenfassen" and "Neu anfangen" (with an in-place confirmation). */
export const MemoryActions = ({ canCompact, canClear, busy, compacting, onCompact, onClear }: MemoryActionsProps) => {
  const [confirming, setConfirming] = useState(false);
  if (confirming)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">Wirklich? Das Gespräch wird gelöscht, dein Projekt bleibt.</span>
        <Button
          size="sm"
          variant="destructive"
          className={ACTION}
          onClick={() => {
            setConfirming(false);
            onClear();
          }}
        >
          Ja, neu anfangen
        </Button>
        <Button size="sm" variant="outline" className={ACTION} onClick={() => setConfirming(false)}>
          Abbrechen
        </Button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" className={ACTION} disabled={!canCompact || busy} onClick={onCompact}>
        {compacting ? (
          <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
        ) : (
          <NotebookPen aria-hidden />
        )}
        {compacting ? 'fasse zusammen…' : 'Zusammenfassen'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={ACTION}
        disabled={!canClear || busy}
        onClick={() => setConfirming(true)}
      >
        <RotateCcw aria-hidden />
        Neu anfangen
      </Button>
    </div>
  );
};

export interface EnergyBarProps {
  /** whole hearts left */
  hearts: number;
  /** progress of the heart that refills next, 0–1 */
  refill: number;
  nextHeartInMs: number;
  /** admin codes have no message limit */
  admin: boolean;
  /** context tokens of the latest turn; undefined before the first */
  context: number | undefined;
  /** the part that is always there (instructions, block list, project): the session's first turn */
  base: number | undefined;
  memory: MemoryActionsProps;
  /** the card above the input shows the actions already; the panel then only explains */
  actionsBelow: boolean;
}

const seconds = (ms: number) => Math.ceil(ms / 1000);

const percentOf = (tokens: number) => Math.min(100, Math.round((tokens / CONTEXT_LIMIT) * 100));
const tokens = (n: number) => n.toLocaleString('de-AT');

/** gauge colour of the conversation: calm, then amber from 60 %, red from 85 % */
const gaugeColor = (percent: number) =>
  percent >= 85 ? 'bg-destructive' : percent >= 60 ? 'bg-gauge-warn' : 'bg-primary';

const HeartIcon = ({ fill }: { fill: number }) => (
  <span className="relative inline-grid size-[1.4em]" data-testid="heart" data-fill={fill >= 1 ? 'full' : 'empty'}>
    <Heart aria-hidden className="col-start-1 row-start-1 size-full text-muted-foreground/45" />
    {fill > 0 && (
      <Heart
        aria-hidden
        className="col-start-1 row-start-1 size-full fill-heart text-heart transition-[clip-path] duration-500 motion-reduce:transition-none"
        // a refilling heart fills from the bottom
        style={fill < 1 ? { clipPath: `inset(${Math.round((1 - fill) * 100)}% 0 0 0)` } : undefined}
      />
    )}
  </span>
);

export const EnergyBar = ({
  hearts,
  refill,
  nextHeartInMs,
  admin,
  context,
  base,
  memory,
  actionsBelow,
}: EnergyBarProps) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // Escape closes the panel
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    addEventListener('keydown', close);
    return () => removeEventListener('keydown', close);
  }, [open]);
  const total = context ?? 0;
  // the always-there part in its own colour: freeing the memory never goes below it
  const fixed = Math.min(base ?? 0, total);
  const percent = percentOf(total);
  const fixedPercent = percentOf(fixed);
  const heartsLabel = admin
    ? 'Admin: Nachrichten ohne Limit'
    : `Noch ${hearts} ${hearts === 1 ? 'Nachricht' : 'Nachrichten'}` +
      (hearts < HEARTS.max ? ` · nächstes Herz in ${seconds(nextHeartInMs)} s` : '');

  return (
    <div className="@container flex-none border-b bg-secondary text-[0.85em]">
      <div className="flex items-center gap-3 px-3 py-1">
        <div className="flex flex-none items-center gap-1" title={heartsLabel} data-testid="hearts">
          <span className="sr-only">{heartsLabel}</span>
          {Array.from({ length: HEARTS.max }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: three fixed slots
            <HeartIcon key={i} fill={admin || i < hearts ? 1 : i === hearts ? refill : 0} />
          ))}
          {admin ? (
            <span aria-hidden className="ml-0.5 font-bold text-heart">
              ∞
            </span>
          ) : (
            hearts < HEARTS.max && (
              <span aria-hidden className="ml-0.5 tabular-nums text-muted-foreground">
                {seconds(nextHeartInMs)} s
              </span>
            )
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          title="Gedächtnis der KI"
          aria-label={`Gedächtnis: ${percent} % voll`}
          className="-mr-1.5 ml-auto flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 outline-none hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring aria-expanded:bg-accent"
        >
          {/* narrow chat or large font: the word goes, the gauge stays (the button keeps its name) */}
          <span className="hidden font-bold @min-[25em]:inline">Gedächtnis</span>
          <span
            aria-hidden
            className="flex h-[0.6em] w-[6em] min-w-[3em] shrink overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_var(--border)]"
          >
            <span
              className="h-full bg-base-knowledge transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${fixedPercent}%` }}
              data-testid="gauge-base"
            />
            <span
              className={cn(
                'h-full transition-[width] duration-500 motion-reduce:transition-none',
                gaugeColor(percent),
              )}
              style={{ width: `${percent - fixedPercent}%` }}
              data-testid="gauge-conversation"
            />
          </span>
          <span
            className="min-w-[3.2em] flex-none text-right whitespace-nowrap tabular-nums"
            data-testid="memory-percent"
          >
            {percent} %
          </span>
        </button>
      </div>
      {open && (
        <div id={panelId} className="flex flex-col gap-2 border-t px-3 pt-2 pb-2.5">
          <p className="font-bold">Das liest die KI bei jeder Nachricht:</p>
          <ul className="flex flex-col gap-0.5 tabular-nums">
            <li className="flex items-baseline gap-2">
              <span aria-hidden className="size-[0.7em] flex-none rounded-full bg-base-knowledge" />
              <span>Grundwissen: ihre Anleitung, die Scratch-Blöcke, dein Projekt</span>
              <span className="ml-auto pl-2" data-testid="tokens-base">
                {tokens(fixed)}
              </span>
            </li>
            <li className="flex items-baseline gap-2">
              <span aria-hidden className={cn('size-[0.7em] flex-none rounded-full', gaugeColor(percent))} />
              <span>Unser Gespräch</span>
              <span className="ml-auto pl-2" data-testid="tokens-conversation">
                {tokens(total - fixed)}
              </span>
            </li>
            <li className="text-muted-foreground">
              zusammen {tokens(total)} von {tokens(CONTEXT_LIMIT)} Tokens
            </li>
          </ul>
          <p>
            Ist das Gedächtnis voll, fasse unser Gespräch zusammen oder fang neu an. Das Grundwissen bleibt, dein
            Projekt auch.
          </p>
          {!actionsBelow && <MemoryActions {...memory} />}
        </div>
      )}
    </div>
  );
};
