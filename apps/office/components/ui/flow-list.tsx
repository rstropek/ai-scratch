import { ArrowDown, ArrowRight } from 'lucide-react';

/** Steps that hand over to each other, in order: numbered items joined by arrows, side by side on wide screens. */
export function FlowList({ items }: { items: readonly { title: string; text: string }[] }) {
  return (
    <ol className="grid gap-6 lg:auto-cols-fr lg:grid-flow-col">
      {items.map((item, index) => (
        <li key={item.title} className="relative grid content-start gap-1.5 text-sm">
          <span className="flex items-center gap-2 font-bold">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-white text-xs tabular-nums">
              {index + 1}
            </span>
            {item.title}
          </span>
          <span>{item.text}</span>
          {index < items.length - 1 && (
            <>
              <ArrowDown
                aria-hidden
                className="-bottom-5 absolute left-3 size-4 -translate-x-1/2 text-primary lg:hidden"
              />
              <ArrowRight
                aria-hidden
                className="-right-5 -translate-y-1/2 absolute top-3 hidden size-4 text-primary lg:block"
              />
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
