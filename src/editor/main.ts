import { registerKiExtension } from './ki-extension.ts';
import { mountScratch } from './mount-scratch.ts';
import * as uiGuide from './ui-guide.ts';

const container = document.getElementById('gui');
if (!container) throw new Error('#gui missing');
// The stage calls preventDefault() on mousedown, so clicking it never moves focus into this iframe: the
// chat input kept it and the game got no keys. Take focus first (capture phase, before the stage).
document.addEventListener('mousedown', () => document.hasFocus() || window.focus(), true);
const { vm, store } = await mountScratch(container);
// before any project is loaded: a project with KI blocks only loads where the extension exists
registerKiExtension(vm, () => window.ki?.ask);
uiGuide.keepPaletteVariablesCurrent(vm);
window.ki = { vm, store, uiGuide };
