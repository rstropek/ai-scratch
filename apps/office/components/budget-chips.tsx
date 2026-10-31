import type { ApplicationStatus, BudgetStatus } from '../lib/applications.ts';
import { texts } from '../lib/texts.ts';
import { Chip, type ChipTone } from './ui/chip.tsx';

const budgetTones: Record<Exclude<BudgetStatus, 'none'>, ChipTone> = {
  missing: 'info',
  pending: 'primary',
  rejected: 'error',
  granted: 'success',
};

/** Where an account's free budget stands; a dash when it never asked for it. */
export function BudgetStatusChip({ status }: { status: BudgetStatus }) {
  if (status === 'none') return <span className="text-muted">–</span>;
  return <Chip tone={budgetTones[status]}>{texts.admin.budgetStatus[status]}</Chip>;
}

const applicationTones: Record<ApplicationStatus, ChipTone> = {
  pending: 'primary',
  accepted: 'success',
  rejected: 'error',
};

/** One application's state: open, accepted, rejected. */
export function ApplicationStatusChip({ status }: { status: ApplicationStatus }) {
  return <Chip tone={applicationTones[status]}>{texts.admin.applicationStatus[status]}</Chip>;
}
