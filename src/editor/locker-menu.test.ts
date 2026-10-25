// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import type { LockerAction } from '../shared/locker.ts';
import { addLockerMenu, SAVE_TO_COMPUTER } from './locker-menu.ts';

const ITEM =
  'class="menu_menu-item_x menu_hoverable_y" tabindex="-1" data-menu-item="true" data-menu-item-wrapper="false"';
/** Scratch's Datei menu as it renders it (scratch-gui 15.3) */
const fileMenu = () =>
  `<ul class="menu_menu_a"><li class="menu_menu-item_x menu_hoverable_y menu_menu-section_z" tabindex="-1" data-menu-item="true"><span>Neu</span></li>` +
  `<li class="menu_menu-item_x menu_hoverable_y menu_menu-section_z" tabindex="-1" data-menu-item="true">Load from your computer</li>` +
  `<li ${ITEM}><span>${SAVE_TO_COMPUTER}</span></li></ul>`;
const settle = () => new Promise((r) => setTimeout(r));

test('each time the Datei menu opens, it gets the two Locker entries in their own section', async () => {
  document.body.innerHTML = '<div id="bar"></div>';
  const opened: LockerAction[] = [];
  const stop = addLockerMenu(document, (action) => opened.push(action));
  const bar = document.getElementById('bar') as HTMLElement;

  for (let i = 0; i < 2; i++) {
    bar.innerHTML = fileMenu();
    await settle();
    const items = [...bar.querySelectorAll('li')];
    expect(items.map((li) => li.textContent)).toEqual([
      'Neu',
      'Load from your computer',
      SAVE_TO_COMPUTER,
      'Aus dem Locker laden',
      'Im Locker speichern',
      'Locker in neuem Tab öffnen',
    ]);
    // the separator above the Locker pair only, and Scratch's keyboard hook finds them
    expect(items.slice(3).map((li) => li.classList.contains('menu_menu-section_z'))).toEqual([true, false, false]);
    expect(items.slice(3).every((li) => li.dataset.menuItem === 'true' && li.tabIndex === -1)).toBe(true);
    bar.innerHTML = ''; // Scratch closes the menu
    await settle();
  }
  expect(opened).toEqual([]);
  stop();
});

test('a click closes the menu like Escape and opens the dialog', async () => {
  document.body.innerHTML = `<div id="bar">${fileMenu()}</div>`;
  const opened: LockerAction[] = [];
  const stop = addLockerMenu(document, (action) => opened.push(action));
  document.body.append(document.createElement('span')); // any change brings the observer in
  await settle();
  const escapes = vi.fn();
  document.getElementById('bar')?.addEventListener('keydown', (e) => escapes(e.key));
  (document.querySelector('[data-locker="save"]') as HTMLElement).click();
  (document.querySelector('[data-locker="load"]') as HTMLElement).click();
  expect(escapes.mock.calls).toEqual([['Escape'], ['Escape']]);
  expect(opened).toEqual(['save', 'load']);
  stop();
});
