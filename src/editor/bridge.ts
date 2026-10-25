// What the editor iframe exposes to the same-origin host as window.ki.
import type { Ask } from '../shared/ki-block.ts';
import type { GuiStore, VirtualMachine } from '../shared/scratch/vm-types.ts';
import type * as UiGuide from './ui-guide.ts';

export interface KiBridge {
  vm: VirtualMachine;
  store: GuiStore;
  /** this window's ui-guide instance: it draws into the editor document */
  uiGuide: typeof UiGuide;
  /** set by the host while the kid has a code: what the "frage KI" block calls (ki-extension.ts) */
  ask?: Ask;
}

declare global {
  interface Window {
    ki?: KiBridge;
  }
}
