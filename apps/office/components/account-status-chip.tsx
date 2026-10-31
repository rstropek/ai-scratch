import type { AccountStatus } from '../lib/applications.ts';
import { texts } from '../lib/texts.ts';
import { Chip, type ChipTone } from './ui/chip.tsx';

const tones: Record<AccountStatus, ChipTone> = {
  parent: 'neutral',
  missing: 'info',
  pending: 'primary',
  accepted: 'success',
  rejected: 'error',
};

/** Where an account stands: parent, teacher without an application, open, accepted, rejected. */
export function AccountStatusChip({ status }: { status: AccountStatus }) {
  return <Chip tone={tones[status]}>{texts.admin.status[status]}</Chip>;
}
