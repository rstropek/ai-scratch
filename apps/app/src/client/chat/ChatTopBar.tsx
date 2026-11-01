// The chat's top bar: continues Scratch's purple menu bar (same height and colour). It holds the code's end time
// ("Code gilt bis 10:50"), the font size buttons, the tool-call toggle and the fold button. KI-Energie sits in
// its own strip below (EnergyBar).
import { AArrowDown, AArrowUp, PanelLeftClose, Wrench } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { FONT_SIZE } from '../ui-prefs.ts';

export interface ChatTopBarProps {
  fontSize: number;
  onFontSize: (size: number) => void;
  /** without it there is no tool toggle (the access gate) */
  showTools?: boolean;
  onShowTools?: (show: boolean) => void;
  /** when the access code stops working (ISO time); the kid sees the end time, never the budget */
  endsAt?: string;
  onFold: () => void;
}

const viennaTime = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' });

/** "Code gilt bis 10:50" */
export const endsAtText = (endsAt: string): string => `Code gilt bis ${viennaTime.format(new Date(endsAt))}`;

/** A white icon button in Scratch's menu-bar style. */
export const BarButton = ({ className, ...props }: ComponentProps<'button'>) => (
  <button
    type="button"
    className={cn(
      'grid size-8 place-items-center rounded-md text-primary-foreground transition-colors duration-150',
      'hover:bg-black/15 focus-visible:outline-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-40',
      'aria-pressed:bg-black/25 [&_svg]:size-5',
      className,
    )}
    {...props}
  />
);

export const ChatTopBar = ({ fontSize, onFontSize, showTools, onShowTools, endsAt, onFold }: ChatTopBarProps) => (
  <div className="flex h-12 flex-none items-center gap-0.5 bg-primary pr-1.5 pl-3 text-primary-foreground">
    <span className="pr-2 text-sm font-bold whitespace-nowrap">KI-Helfer</span>
    <span className="mr-auto min-w-0 truncate pr-2 text-xs opacity-85" data-testid="code-ends">
      {endsAt && endsAtText(endsAt)}
    </span>
    <BarButton
      aria-label="Schrift kleiner"
      title="Schrift kleiner"
      disabled={fontSize <= FONT_SIZE.min}
      onClick={() => onFontSize(Math.max(FONT_SIZE.min, fontSize - FONT_SIZE.step))}
    >
      <AArrowDown />
    </BarButton>
    <BarButton
      aria-label="Schrift größer"
      title="Schrift größer"
      disabled={fontSize >= FONT_SIZE.max}
      onClick={() => onFontSize(Math.min(FONT_SIZE.max, fontSize + FONT_SIZE.step))}
    >
      <AArrowUp />
    </BarButton>
    {onShowTools && (
      <BarButton
        aria-label="Werkzeuge anzeigen"
        title={showTools ? 'Werkzeuge verstecken' : 'Werkzeuge anzeigen'}
        aria-pressed={showTools}
        onClick={() => onShowTools(!showTools)}
      >
        <Wrench />
      </BarButton>
    )}
    <span className="mx-1 h-5 w-px bg-white/30" aria-hidden />
    <BarButton aria-label="Chat einklappen" title="Chat einklappen" onClick={onFold}>
      <PanelLeftClose />
    </BarButton>
  </div>
);
