import { mountScratch } from './mount-scratch.ts';
import * as uiGuide from './ui-guide.ts';

const container = document.getElementById('gui');
if (!container) throw new Error('#gui missing');
const { vm, store } = await mountScratch(container);
window.ki = { vm, store, uiGuide };
