'use client';

import { ArrowLeft, ArrowRight, Check, Gauge, RotateCcw, ShieldCheck } from 'lucide-react';
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { access, type TourStep } from '../content/access.tsx';
import { AccessMap } from './access-map.tsx';
import { Button } from './ui/button.tsx';
import { Chip } from './ui/chip.tsx';
import { cx } from './ui/cx.ts';

const t = access.tour;

/** The click-through on /access: the step buttons, the diagram lit for the current step, and its text. */
export function AccessTour() {
  const [index, setIndex] = useState(0);
  const stepButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLElement>(null);
  const headingId = useId();
  const count = t.steps.length;
  const step = t.steps[index];
  if (!step) return null;
  const last = index === count - 1;

  // left and right arrows move along the step buttons, like a toolbar
  const onStepKey = (event: KeyboardEvent) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const target = index + offset;
    if (offset === 0 || target < 0 || target >= count) return;
    event.preventDefault();
    setIndex(target);
    stepButtons.current[target]?.focus();
  };

  // Zurück and Weiter sit under the text: on phones the diagram is out of sight there, so the new step starts at its top
  const go = (target: number) => {
    setIndex(target);
    const element = panel.current;
    if (!element || element.getBoundingClientRect().top >= 0) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <section
      ref={panel}
      aria-labelledby={headingId}
      className="min-w-0 scroll-mt-4 overflow-clip rounded-panel border border-divider bg-surface"
    >
      <div className="grid gap-3 px-6 pt-5 pb-4">
        <div className="grid gap-0.5">
          <h2 id={headingId} className="font-bold text-lg">
            {t.title}
          </h2>
          <p className="text-muted text-sm">{t.intro}</p>
        </div>
        <ol aria-label={t.stepsLabel} className="flex flex-wrap gap-1.5" onKeyDown={onStepKey}>
          {t.steps.map((s, i) => {
            const current = i === index;
            return (
              <li key={s.short}>
                <button
                  ref={(button) => {
                    stepButtons.current[i] = button;
                  }}
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  aria-label={`${i + 1}. ${s.title}`}
                  onClick={() => setIndex(i)}
                  className={cx(
                    'inline-flex items-center gap-2 rounded-full p-1 font-bold text-sm transition-colors duration-150 ease-out focus-visible:focus-ring sm:pr-3',
                    current
                      ? 'bg-primary text-white'
                      : i < index
                        ? 'bg-primary-light text-primary-ink hover:bg-accent'
                        : 'text-foreground hover:bg-subtle',
                  )}
                >
                  <span
                    className={cx(
                      'grid size-6 place-items-center rounded-full text-xs tabular-nums',
                      current ? 'bg-white text-primary-ink' : i < index ? 'bg-primary text-white' : 'bg-accent',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* phones: title, diagram, text. From tablets up the diagram sits beside title and text, so a click on Weiter
          shows both changing. */}
      <div className="grid border-divider border-t [grid-template-areas:'title'_'map'_'text'] md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:[grid-template-areas:'map_title'_'map_text'] lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <h3 className="text-balance px-6 pt-5 pb-4 font-bold text-lg [grid-area:title] md:pb-0">{step.title}</h3>
        <div className="border-divider border-y bg-subtle px-4 py-5 [grid-area:map] md:border-y-0 md:border-r">
          <AccessMap
            texts={t.nodes}
            label={t.mapLabel}
            activeNodes={step.nodes}
            activeEdges={step.edges}
            className="mx-auto max-w-[22rem] lg:max-w-[26rem]"
          />
          <p className="mt-3 flex items-center justify-center gap-2 text-muted text-xs">
            <svg aria-hidden width="28" height="4" className="shrink-0">
              <line x1="0" y1="2" x2="28" y2="2" strokeWidth={1.5} className="stroke-neutral [stroke-dasharray:4_5]" />
            </svg>
            {t.keyLegend}
          </p>
        </div>

        {/* every step's text in one cell, only the current one visible: from tablets up the panel keeps the height of the longest
            step, so Weiter stays where the pointer is */}
        <div className="grid px-6 pt-3 pb-5 [grid-area:text]">
          {t.steps.map((s, i) => (
            <StepText key={s.short} step={s} hidden={i !== index} />
          ))}
        </div>
      </div>

      {/* sticky: on phones Weiter stays in reach while the text is read */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-panel border-divider border-t bg-surface px-6 py-3">
        <Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)}>
          <ArrowLeft aria-hidden />
          {t.back}
        </Button>
        {/* says the new step to screen readers; the buttons keep the focus */}
        <p aria-live="polite" className="sr-only">
          {`${t.position(index + 1, count)}: ${step.title}`}
        </p>
        <Button onClick={() => go(last ? 0 : index + 1)}>
          {last ? (
            <>
              <RotateCcw aria-hidden />
              {t.restart}
            </>
          ) : (
            <>
              {t.next}
              <ArrowRight aria-hidden />
            </>
          )}
        </Button>
      </div>
    </section>
  );
}

function StepText({ step, hidden }: { step: TourStep; hidden: boolean }) {
  return (
    <div
      inert={hidden}
      className={cx('grid content-start gap-5 [grid-area:1/1]', hidden && 'max-md:hidden md:invisible')}
    >
      <div className="grid content-start gap-3">
        <p className="flex flex-wrap items-center gap-2 text-muted text-sm">
          {t.actor} <Chip tone={step.actor.tone}>{step.actor.label}</Chip>
        </p>
        <div className="grid max-w-[68ch] gap-2">
          {step.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {step.checks && (
          <ul className="grid max-w-[68ch] gap-1.5">
            {step.checks.map((check) => (
              <li key={check} className="flex gap-2">
                <Check aria-hidden className="mt-0.75 size-4 shrink-0 text-success-ink" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid content-start gap-4 text-sm">
        <FactList title={t.limits} items={step.limits} icon="limit" />
        <FactList title={t.safety} items={step.safety} icon="safety" />
      </div>
    </div>
  );
}

function FactList({ title, items, icon }: { title: string; items: readonly string[]; icon: 'limit' | 'safety' }) {
  if (items.length === 0) return null;
  const Icon = icon === 'limit' ? Gauge : ShieldCheck;
  return (
    <div className="grid gap-1.5">
      <p className="font-bold">{title}</p>
      <ul className="grid gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Icon
              aria-hidden
              className={cx('mt-0.5 size-4 shrink-0', icon === 'limit' ? 'text-warning-ink' : 'text-success-ink')}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
