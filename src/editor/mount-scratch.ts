// Mounts the unmodified Scratch editor (standalone build, window.GUI) and hands out the VM.
// This is the *only* integration point with Scratch: public exports of @scratch/scratch-gui
// (EditorState, createStandaloneRoot, onVmInit prop) + the public scratch-vm API.
import type { GuiStore, VirtualMachine } from '../shared/scratch/vm-types.ts';

interface StandaloneGui {
  EditorState: new (options: { locale: string }) => { store: GuiStore };
  createStandaloneRoot(state: { store: GuiStore }, container: HTMLElement): { render(props: object): void };
  setAppElement(element: HTMLElement): void;
}

declare global {
  interface Window {
    GUI?: StandaloneGui;
  }
}

export const mountScratch = (container: HTMLElement): Promise<{ vm: VirtualMachine; store: GuiStore }> =>
  new Promise((resolve, reject) => {
    const gui = window.GUI;
    if (!gui) {
      reject(new Error('scratch-gui-standalone.js did not load'));
      return;
    }
    gui.setAppElement(container);
    const state = new gui.EditorState({ locale: 'de' });
    // Mount exactly once and never unmount: the editor crashes on unmount (Blockly focus manager).
    gui.createStandaloneRoot(state, container).render({
      projectId: '0', // '0' = built-in default project (the cat); normally set by HashParserHOC
      canEditTitle: true,
      canSave: false,
      backpackVisible: false,
      // fires once the VM exists; the same instance is also at state.store.getState().scratchGui.vm
      onVmInit: (vm: VirtualMachine) => resolve({ vm, store: state.store }),
    });
  });
