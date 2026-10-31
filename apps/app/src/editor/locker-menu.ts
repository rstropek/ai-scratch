// Adds "Aus dem Locker laden", "Im Locker speichern" and "Locker in neuem Tab öffnen" to Scratch's Datei
// menu, without touching the bundle (docs/locker.md). Scratch renders the menu only while it is open, so
// every time it appears our items are cloned from its "Auf deinem Computer speichern" item: same look, and
// Scratch's own menu hook moves through them with the arrow keys and clicks them on Enter (it looks for
// data-menu-item). That item is found by its label in the language the kid picked in Scratch.

import type { LockerAction } from '../shared/locker.ts';
import type { GuiStore } from '../shared/scratch/vm-types.ts';

/** Scratch's message for the item we anchor on; e2e/locker.spec.ts notices when an upgrade changes it */
const SAVE_TO_COMPUTER = 'gui.menuBar.downloadToComputer';
/** what Scratch shows for it where a language has no translation (English among them) */
const SAVE_TO_COMPUTER_DEFAULT = 'Save to your computer';

/** The "save to your computer" label in the editor's current language. */
export const saveToComputerLabel = (store: GuiStore): string =>
  store.getState().locales.messages[SAVE_TO_COMPUTER] ?? SAVE_TO_COMPUTER_DEFAULT;

export const LOCKER_MENU_LABELS: Record<LockerAction, string> = {
  load: 'Aus dem Locker laden',
  save: 'Im Locker speichern',
  open: 'Locker in neuem Tab öffnen',
};

/** `anchorLabel`: Scratch's "save to your computer" label right now. Returns a function that stops adding them. */
export const addLockerMenu = (
  doc: Document,
  anchorLabel: () => string,
  open: (action: LockerAction) => void,
): (() => void) => {
  const inject = () => {
    const label = anchorLabel();
    const anchor = [...doc.querySelectorAll<HTMLElement>('li[data-menu-item]')].find(
      (li) => li.textContent?.trim() === label,
    );
    const menu = anchor?.parentElement;
    if (!anchor || !menu || menu.querySelector('[data-locker]')) return;
    // the line above a group: Scratch puts this class on the first item of each section
    const section = [...menu.querySelectorAll('li')]
      .flatMap((li) => [...li.classList])
      .find((c) => /^menu_menu-section_/.test(c));
    const item = (action: LockerAction, first: boolean) => {
      const li = anchor.cloneNode(false) as HTMLElement;
      li.dataset.locker = action;
      if (section) li.classList.toggle(section, first);
      li.append(Object.assign(doc.createElement('span'), { textContent: LOCKER_MENU_LABELS[action] }));
      li.addEventListener('click', () => {
        // closes the menu the way Scratch's own menu hook does on Escape
        li.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        open(action);
      });
      return li;
    };
    menu.append(item('load', true), item('save', false), item('open', false));
  };
  const observer = new MutationObserver(inject);
  observer.observe(doc.body, { childList: true, subtree: true });
  return () => observer.disconnect();
};
