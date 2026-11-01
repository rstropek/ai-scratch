import { displayCode } from '@ai-scratch/db';
import type { CodeListPage } from '../app/codes/actions.ts';
import { DeleteCodeForm } from '../app/codes/delete-code-form.tsx';
import { type CodeRow, type CodeState, codeState } from '../lib/codes.ts';
import { texts } from '../lib/texts.ts';
import { CopyButton } from './copy-button.tsx';
import { Chip, type ChipTone } from './ui/chip.tsx';
import { Cell, type Column, Table, TableFooter } from './ui/table.tsx';

const c = texts.codes;

const stateTones: Record<CodeState, ChipTone> = { running: 'success', planned: 'info', expired: 'neutral' };

/** Codes with their window, state, source, comment and spend; `back`: where a delete returns to (admins see owners). */
export function CodesTable({
  rows,
  codeBudgetUsd,
  back,
  now = new Date(),
}: {
  rows: CodeRow[];
  codeBudgetUsd: number;
  back: CodeListPage;
  now?: Date;
}) {
  const withOwner = back === 'admin';
  const columns: Column[] = [
    { label: c.columns.code },
    { label: c.columns.window },
    { label: c.columns.state },
    { label: c.columns.source },
    ...(withOwner ? [{ label: c.columns.owner }] : []),
    { label: c.columns.spent },
    { label: c.columns.action, hidden: true },
  ];
  return (
    <>
      <Table columns={columns}>
        {rows.map((row) => {
          const state = codeState(row, now);
          const code = displayCode(row.code);
          return (
            <tr key={row.id}>
              <Cell sub={row.comment || undefined}>
                <span className="inline-flex items-center gap-1">
                  <span className="whitespace-nowrap font-bold font-mono">{code}</span>
                  <CopyButton value={code} label={c.copy(code)} />
                </span>
              </Cell>
              <Cell sub={row.askEnabled ? undefined : c.askOff}>{texts.format.window(row.startsAt, row.endsAt)}</Cell>
              <Cell>
                <Chip tone={stateTones[state]}>{c.state[state]}</Chip>
              </Cell>
              <Cell sub={row.key?.hint}>{row.key ? c.sourceShort.openrouter(row.key.label) : c.sourceShort.free}</Cell>
              {withOwner && <Cell sub={row.owner.email}>{row.owner.name}</Cell>}
              <Cell sub={c.spentLeft(row.spentUsd, codeBudgetUsd)}>
                <span className="whitespace-nowrap">{c.spent(row.spentUsd, codeBudgetUsd)}</span>
              </Cell>
              <Cell action>
                <DeleteCodeForm id={row.id} code={code} back={back} />
              </Cell>
            </tr>
          );
        })}
      </Table>
      <TableFooter>{c.footer(rows.length)}</TableFooter>
    </>
  );
}
