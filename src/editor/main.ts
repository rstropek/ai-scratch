import { registerKiExtension } from './ki-extension.ts';
import { mountScratch } from './mount-scratch.ts';
import * as uiGuide from './ui-guide.ts';

const container = document.getElementById('gui');
if (!container) throw new Error('#gui missing');
const { vm, store } = await mountScratch(container);
// before any project is loaded: a project with KI blocks only loads where the extension exists
registerKiExtension(vm, () => window.ki?.ask);
uiGuide.keepPaletteVariablesCurrent(vm);
window.ki = { vm, store, uiGuide };
