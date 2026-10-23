// A drag handle that resizes its neighbour: axis "x" for a column width, "y" for a row height.
// Pointer capture keeps the drag going over the Scratch iframe; arrow keys and double-click (reset)
// make it usable without a mouse.
import { type KeyboardEvent, type PointerEvent, useRef } from 'react';
import { cn } from '@/lib/utils';
import { clamp } from '../ui-prefs.ts';

const KEY_STEP = 16;

export interface SplitterProps {
  axis: 'x' | 'y';
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onReset: () => void;
  /** true when dragging towards smaller coordinates (up/left) makes the value bigger */
  invert?: boolean;
  onDragChange?: (dragging: boolean) => void;
  label: string;
  className?: string;
}

export const Splitter = ({
  axis,
  value,
  min,
  max,
  onChange,
  onReset,
  invert = false,
  onDragChange,
  label,
  className,
}: SplitterProps) => {
  const drag = useRef<{ start: number; value: number } | null>(null);
  const sign = invert ? -1 : 1;
  const pos = (e: PointerEvent) => (axis === 'x' ? e.clientX : e.clientY);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: pos(e), value };
    onDragChange?.(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onChange(clamp(drag.current.value + sign * (pos(e) - drag.current.start), min, max));
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onDragChange?.(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const [less, more] = axis === 'x' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowDown', 'ArrowUp'];
    const step = e.key === more ? KEY_STEP : e.key === less ? -KEY_STEP : 0;
    if (step) onChange(clamp(value + (axis === 'x' ? sign * step : step), min, max));
    else if (e.key === 'Home') onChange(min);
    else if (e.key === 'End') onChange(max);
    else return;
    e.preventDefault();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA window-splitter pattern; <hr> can't take focus
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      title={`${label} (Doppelklick: zurücksetzen)`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative flex-none touch-none select-none outline-none',
        axis === 'x' ? 'w-1.5 cursor-col-resize' : 'h-2 cursor-row-resize',
        className,
      )}
    >
      {/* grip: a small Scratch-style pill that lights up purple on hover, focus and drag */}
      <span
        className={cn(
          'absolute top-1/2 left-1/2 -translate-1/2 rounded-full bg-foreground/25 transition-colors duration-150',
          'group-hover:bg-primary group-focus-visible:bg-primary group-active:bg-primary',
          axis === 'x' ? 'h-8 w-1' : 'h-1 w-8',
        )}
      />
    </div>
  );
};
