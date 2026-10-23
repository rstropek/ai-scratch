// The chat's top bar: continues Scratch's purple menu bar (same height and colour). It holds the font
// size buttons, the tool-call toggle, the fold button and an empty slot for the token health bar.
import { AArrowDown, AArrowUp, PanelLeftClose, Wrench } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { FONT_SIZE } from '../ui-prefs.ts';

export interface ChatTopBarProps {
  fontSize: number;
  onFontSize: (size: number) => void;
  showTools: boolean;
  onShowTools: (show: boolean) => void;
  onFold: () => void;
}

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

export const ChatTopBar = ({ fontSize, onFontSize, showTools, onShowTools, onFold }: ChatTopBarProps) => (
  <div className="flex h-12 flex-none items-center gap-0.5 bg-primary pr-1.5 pl-3 text-primary-foreground">
    <span className="mr-2 text-sm font-bold whitespace-nowrap">KI-Helfer</span>
    {/* placeholder for the token health bar (coming sprint) */}
    <div data-slot="energy" className="min-w-0 flex-1" />
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
    <BarButton
      aria-label="Werkzeuge anzeigen"
      title={showTools ? 'Werkzeuge verstecken' : 'Werkzeuge anzeigen'}
      aria-pressed={showTools}
      onClick={() => onShowTools(!showTools)}
    >
      <Wrench />
    </BarButton>
    <span className="mx-1 h-5 w-px bg-white/30" aria-hidden />
    <BarButton aria-label="Chat einklappen" title="Chat einklappen" onClick={onFold}>
      <PanelLeftClose />
    </BarButton>
  </div>
);
