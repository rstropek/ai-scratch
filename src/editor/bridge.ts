// What the editor iframe exposes to the same-origin host as window.ki.
import type { Ask } from '../shared/ki-block.ts';
import type { LockerAction } from '../shared/locker.ts';
import type { GuiStore, VirtualMachine } from '../shared/scratch/vm-types.ts';
import type * as UiGuide from './ui-guide.ts';

export interface KiBridge {
  vm: VirtualMachine;
  store: GuiStore;
  /** this window's ui-guide instance: it draws into the editor document */
  uiGuide: typeof UiGuide;
  /** set by the host while the kid has a code: what the "frage KI" block calls (ki-extension.ts) */
  ask?: Ask;
  /** set by the host: opens its Locker dialog for the Datei menu's Locker entries (locker-menu.ts) */
  openLocker?: (action: LockerAction) => void;
}

declare global {
  interface Window {
    ki?: KiBridge;
  }
}
