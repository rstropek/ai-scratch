// KI-Energie under the chat's top bar (rules in src/shared/energy.ts): the hearts (messages left, one
// refills every 20 s) and the Gedächtnis gauge (the context the AI reads, up to the limit). The gauge
// opens the two ways to free the memory, which the kid uses by hand.
import { Heart, NotebookPen, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
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
          className="text-[length:inherit]"
          onClick={() => {
            setConfirming(false);
            onClear();
          }}
        >
          Ja, neu anfangen
        </Button>
        <Button size="sm" variant="outline" className="text-[length:inherit]" onClick={() => setConfirming(false)}>
          Abbrechen
        </Button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        className="text-[length:inherit] [&_svg]:size-[1.1em]"
        disabled={!canCompact || busy}
        onClick={onCompact}
      >
        <NotebookPen aria-hidden />
        {compacting ? 'fasse zusammen…' : 'Zusammenfassen'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-[length:inherit] [&_svg]:size-[1.1em]"
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
  memory: MemoryActionsProps;
}

const seconds = (ms: number) => Math.ceil(ms / 1000);

/** gauge colour: calm, then amber from 60 %, red from 85 % */
const gaugeColor = (percent: number) =>
  percent >= 85 ? 'bg-destructive' : percent >= 60 ? 'bg-gauge-warn' : 'bg-primary';

const HeartIcon = ({ fill }: { fill: number }) => (
  <span className="relative inline-grid size-[1.4em]" data-testid="heart" data-fill={fill >= 1 ? 'full' : 'empty'}>
    <Heart aria-hidden className="col-start-1 row-start-1 size-full text-muted-foreground/45" />
    {fill > 0 && (
      <Heart
        aria-hidden
        className="col-start-1 row-start-1 size-full fill-heart text-heart transition-[clip-path] duration-500"
        // a refilling heart fills from the bottom
        style={fill < 1 ? { clipPath: `inset(${Math.round((1 - fill) * 100)}% 0 0 0)` } : undefined}
      />
    )}
  </span>
);

export const EnergyBar = ({ hearts, refill, nextHeartInMs, admin, context, memory }: EnergyBarProps) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const percent = context === undefined ? 0 : Math.min(100, Math.round((context / CONTEXT_LIMIT) * 100));
  const heartsLabel = admin
    ? 'Admin: Nachrichten ohne Limit'
    : `Noch ${hearts} ${hearts === 1 ? 'Nachricht' : 'Nachrichten'}` +
      (hearts < HEARTS.max ? ` · nächstes Herz in ${seconds(nextHeartInMs)} s` : '');

  return (
    <div className="flex-none border-b bg-secondary text-[0.85em]">
      <div className="flex items-center gap-3 px-3 py-1">
        <div className="flex items-center gap-1" title={heartsLabel} data-testid="hearts">
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
          className="ml-auto flex items-center gap-2 rounded-md px-1.5 py-0.5 outline-none hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring"
        >
          <span className="font-bold">Gedächtnis</span>
          <span
            aria-hidden
            className="h-[0.6em] w-[5em] overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_var(--border)]"
          >
            <span
              className={cn('block h-full rounded-full transition-[width] duration-500', gaugeColor(percent))}
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="w-[2.6em] text-right tabular-nums" data-testid="memory-percent">
            {percent} %
          </span>
        </button>
      </div>
      {open && (
        <div id={panelId} className="flex flex-col gap-2 border-t px-3 py-2">
          <p>
            Hier merkt sich die KI unser Gespräch, dazu ihre Anleitung und dein Projekt. Ist das Gedächtnis voll, fasse
            das Gespräch zusammen oder fang neu an. Dein Projekt bleibt erhalten.
          </p>
          <p className="text-muted-foreground tabular-nums">
            {(context ?? 0).toLocaleString('de-AT')} von {CONTEXT_LIMIT.toLocaleString('de-AT')} Tokens
          </p>
          <MemoryActions {...memory} />
        </div>
      )}
    </div>
  );
};
