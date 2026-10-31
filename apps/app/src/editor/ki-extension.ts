// The "KI" block category for kids' own programs: `frage KI [ ]` reports the AI's answer, e.g. for a chatbot.
// Registered in-process on the unmodified VM, the way the built-in extensions are, so it needs no sandbox.
// The host supplies the actual ask (src/client/ki-ask.ts) once the kid has entered a code.
// Traps: getInfo() needs color1, color2 *and* color3 (without color3 the whole workspace stops rendering),
// and a project with these blocks only loads where the extension is registered first: here it always is,
// on scratch.mit.edu it is not.
import { ASK_FAILED, ASK_NO_CODE, type Ask } from '../shared/ki-block.ts';
import type { Runtime, VirtualMachine } from '../shared/scratch/vm-types.ts';

export const KI_EXTENSION_ID = 'ki';

const ICON = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><text x="4" y="30" font-size="28">🤖</text></svg>',
)}`;

class KiExtension {
  readonly #getAsk: () => Ask | undefined;
  /** aborted when the project stops (stop sign, green flag): the scripts waiting for an answer are gone */
  #stop = new AbortController();

  constructor(runtime: Runtime, getAsk: () => Ask | undefined) {
    this.#getAsk = getAsk;
    runtime.on('PROJECT_STOP_ALL', () => {
      this.#stop.abort();
      this.#stop = new AbortController();
    });
  }

  getInfo() {
    return {
      id: KI_EXTENSION_ID,
      name: 'KI',
      color1: '#ff4fa3',
      color2: '#e0388a',
      color3: '#c22a76',
      blockIconURI: ICON,
      menuIconURI: ICON,
      blocks: [
        {
          opcode: 'ask',
          blockType: 'reporter',
          text: 'frage KI [QUESTION]',
          arguments: { QUESTION: { type: 'string', defaultValue: 'Erzähl mir einen Witz' } },
          // a stage monitor would ask again and again
          disableMonitor: true,
        },
      ],
    };
  }

  ask({ QUESTION }: { QUESTION?: unknown }): string | Promise<string> {
    const question = String(QUESTION ?? '').trim();
    if (!question) return '';
    const ask = this.#getAsk();
    if (!ask) return ASK_NO_CODE;
    const { signal } = this.#stop;
    return ask(question, signal).catch(() => (signal.aborted ? '' : ASK_FAILED));
  }
}

/** Adds the KI category to the palette; call it before any project with KI blocks is loaded. */
export const registerKiExtension = (vm: VirtualMachine, getAsk: () => Ask | undefined): void => {
  if (vm.extensionManager.isExtensionLoaded(KI_EXTENSION_ID)) return;
  const service = vm.extensionManager._registerInternalExtension(new KiExtension(vm.runtime, getAsk));
  vm.extensionManager._loadedExtensions.set(KI_EXTENSION_ID, service);
};
