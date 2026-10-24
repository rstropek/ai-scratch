// Plays a Scratch project in the real editor (a Playwright page of the app) with the test in control of
// time: the VM's own 30 fps interval is stopped and the test steps it frame by frame, with Date.now (the
// VM's only clock) advanced by exactly one frame per step. A bot then reacts to every frame however long
// it takes, waits ("warte 1 Sekunde") last exactly as many frames as in a real run, and Math.random is
// seeded per green flag, so a run plays the same every time. The renderer is the real one, so "wird
// berührt?" and clicks hit the drawn pixels.
import type { Frame, Page } from '@playwright/test';

export interface TargetState {
  id: string;
  name: string;
  clone: boolean;
  x: number;
  y: number;
  visible: boolean;
  costume: string;
  /** asset id of the current costume: equal images have equal ids */
  look: string;
  /** stage coordinates of the drawn image */
  bounds: { left: number; right: number; top: number; bottom: number } | null;
  /** reacts to clicks: a "Wenn diese Figur angeklickt wird" script, or polling for a mouse click on itself
   * (clones share their sprite's scripts) */
  clickable: boolean;
}

export interface StageState {
  frame: number;
  targets: TargetState[];
  backdrop: string;
  /** global and sprite-local variables by name (numbers stay strings when Scratch stores them so) */
  variables: Record<string, string | number>;
  lists: Record<string, (string | number)[]>;
  threads: number;
}

/** What happened since the last green flag. */
export interface PlayEvents {
  says: { frame: number; sprite: string; text: string }[];
  broadcasts: { frame: number; name: string }[];
  stopAll: number[];
  maxClones: number;
}

export type Policy =
  | { kind: 'none' }
  /** hold these keys (with key repeat) and keep the mouse at a stage position */
  | { kind: 'hold'; keys: string[]; mouse?: [x: number, y: number] }
  /** move `catcher` (arrow keys + mouse) under the lowest falling object, or away from everything falling */
  | { kind: 'catch' | 'avoid'; catcher: string }
  /** like catch, and taps `key` (default space) to shoot at it */
  | { kind: 'shoot'; catcher: string; key?: string }
  /** steer `mover` (arrow keys + mouse) towards `target`, one axis at a time */
  | { kind: 'seek'; mover: string; target: string };

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: the in-page player is plain JS on the VM's internals
    __player?: any;
  }
}

/** Installed into the editor frame; must not reference anything outside itself (it is serialized). */
const installPlayer = () => {
  if (window.__player) return;
  // biome-ignore lint/suspicious/noExplicitAny: VM internals
  const vm = window.ki?.vm as any;
  const runtime = vm.runtime;
  const realNow = Date.now.bind(Date);
  const STEP = 1000 / 30;
  const clock = { manual: false, now: realNow(), base: 0 };
  // a tiny tick per call keeps the sequencer's 75%-of-a-frame budget finite for scripts that never redraw
  Date.now = () => {
    if (!clock.manual) return realNow();
    clock.now += 0.01;
    return clock.now;
  };

  let seed = 1;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const realRandom = Math.random;

  let frame = 0;
  let flagFrame = 0;
  // biome-ignore lint/suspicious/noExplicitAny: events collected for the test
  const events: any = { says: [], broadcasts: [], stopAll: [], maxClones: 0 };
  // biome-ignore lint/suspicious/noExplicitAny: VM target
  runtime.on('SAY', (target: any, _type: string, text: unknown) => {
    if (String(text ?? '').trim()) events.says.push({ frame, sprite: target.getName(), text: String(text) });
  });
  runtime.on('PROJECT_STOP_ALL', () => {
    if (frame > flagFrame) events.stopAll.push(frame);
  });
  const startHats = runtime.startHats.bind(runtime);
  // biome-ignore lint/suspicious/noExplicitAny: VM hat fields
  runtime.startHats = (opcode: string, fields: any, target: any) => {
    if (opcode === 'event_whenbroadcastreceived' && fields?.BROADCAST_OPTION)
      events.broadcasts.push({ frame, name: String(fields.BROADCAST_OPTION) });
    return startHats(opcode, fields, target);
  };

  const canvas = () => runtime.renderer.canvas as HTMLCanvasElement;
  const toClient = (x: number, y: number) => {
    const r = canvas().getBoundingClientRect();
    return {
      x: ((x + 240) / 480) * r.width,
      y: ((180 - y) / 360) * r.height,
      canvasWidth: r.width,
      canvasHeight: r.height,
    };
  };
  // biome-ignore lint/suspicious/noExplicitAny: VM target
  const clickable = (t: any) => {
    const blocks = Object.values(
      (t.sprite?.blocks ?? t.blocks)._blocks as Record<
        string,
        { opcode: string; topLevel: boolean; fields: Record<string, { value: string }> }
      >,
    );
    if (blocks.some((b) => b.topLevel && b.opcode === 'event_whenthisspriteclicked')) return true;
    // polling: "wird Maus gedrückt?" together with "wird Mauszeiger berührt?"
    return (
      blocks.some((b) => b.opcode === 'sensing_mousedown') &&
      blocks.some((b) => b.fields.TOUCHINGOBJECTMENU?.value === '_mouse_')
    );
  };
  // biome-ignore lint/suspicious/noExplicitAny: VM target
  const targetState = (t: any) => {
    const costume = t.getCostumes()[t.currentCostume];
    let bounds = null;
    try {
      const b = runtime.renderer.getBounds(t.drawableID);
      bounds = { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    } catch {}
    return {
      id: t.id,
      name: t.getName(),
      clone: !t.isOriginal,
      x: Math.round(t.x),
      y: Math.round(t.y),
      visible: t.visible,
      costume: costume?.name ?? '',
      look: costume?.assetId ?? '',
      bounds,
      clickable: clickable(t),
    };
  };
  const state = () => {
    // biome-ignore lint/suspicious/noExplicitAny: VM targets
    const targets = runtime.targets as any[];
    const stage = runtime.getTargetForStage();
    const variables: Record<string, unknown> = {};
    const lists: Record<string, unknown> = {};
    for (const t of targets.filter((x) => x.isOriginal)) {
      for (const v of Object.values(t.variables) as { name: string; type: string; value: unknown }[]) {
        if (v.type === '') variables[v.name] = v.value;
        if (v.type === 'list') lists[v.name] = [...(v.value as unknown[])];
      }
    }
    return {
      frame,
      targets: targets.filter((t) => !t.isStage).map(targetState),
      backdrop: stage.getCostumes()[stage.currentCostume]?.name ?? '',
      variables,
      lists,
      threads: runtime.threads.length,
    };
  };

  // keys: like a real keyboard, a held key repeats after 500 ms
  const held = new Map<string, number>();
  const press = (key: string, down: boolean) => vm.postIOData('keyboard', { key, isDown: down });
  const hold = (keys: string[]) => {
    for (const [key] of held)
      if (!keys.includes(key)) {
        press(key, false);
        held.delete(key);
      }
    for (const key of keys) {
      const since = held.get(key);
      if (since === undefined) {
        held.set(key, frame);
        press(key, true);
      } else if (frame - since >= 15) press(key, true);
    }
  };
  const mouseTo = (x: number, y: number) => vm.postIOData('mouse', toClient(x, y));

  // biome-ignore lint/suspicious/noExplicitAny: policy object from the test
  const steer = (policy: any) => {
    if (policy.kind === 'none') return;
    if (policy.kind === 'hold') {
      hold(policy.keys);
      if (policy.mouse) mouseTo(policy.mouse[0], policy.mouse[1]);
      return;
    }
    // biome-ignore lint/suspicious/noExplicitAny: VM targets
    const targets = runtime.targets as any[];
    if (policy.kind === 'seek') {
      const mover = targets.find((t) => t.isOriginal && t.getName() === policy.mover);
      const target = targets.find((t) => t.isOriginal && t.getName() === policy.target);
      if (!mover || !target) return;
      const dx = target.x - mover.x;
      const dy = target.y - mover.y;
      const keys =
        Math.abs(dx) < 5 && Math.abs(dy) < 5
          ? []
          : Math.abs(dx) > Math.abs(dy)
            ? [dx > 0 ? 'ArrowRight' : 'ArrowLeft']
            : [dy > 0 ? 'ArrowUp' : 'ArrowDown'];
      hold(keys);
      mouseTo(Math.max(-235, Math.min(235, target.x)), Math.max(-175, Math.min(175, target.y)));
      return;
    }
    const catcher = targets.find((t) => t.isOriginal && t.getName() === policy.catcher);
    if (!catcher) return;
    const falling = targets.filter(
      (t) => t !== catcher && !t.isStage && t.visible && t.y > catcher.y && (lastY.get(t.id) ?? t.y) > t.y,
    );
    const next = falling.sort((a, b) => a.y - b.y)[0];
    let goal = catcher.x;
    if (next && policy.kind !== 'avoid') goal = next.x;
    // avoid: the place farthest from everything falling in the lower part of the stage
    const near = falling.filter((t) => t.y < catcher.y + 250);
    if (near.length && policy.kind === 'avoid') {
      const room = (x: number) => Math.min(...near.map((t) => Math.abs(t.x - x)));
      for (let x = -200; x <= 200; x += 25) if (room(x) > room(goal) + 10) goal = x;
    }
    const dx = goal - catcher.x;
    const tap = policy.kind === 'shoot' && frame % 10 < 3 ? [policy.key ?? ' '] : [];
    hold([...(Math.abs(dx) < 8 ? [] : dx > 0 ? ['ArrowRight'] : ['ArrowLeft']), ...tap]);
    mouseTo(Math.max(-235, Math.min(235, goal)), catcher.y);
  };
  const lastY = new Map<string, number>();

  // seeded only while the VM steps: the editor's own code (React, the GUI) runs in between and would use
  // up the sequence at its own pace
  let seeded = false;
  const step = () => {
    clock.now = Math.max(clock.now, clock.base + frame * STEP);
    if (seeded) Math.random = random;
    try {
      runtime._step();
    } finally {
      Math.random = realRandom;
    }
    frame += 1;
    events.maxClones = Math.max(
      events.maxClones,
      runtime.targets.filter((t: { isOriginal: boolean }) => !t.isOriginal).length,
    );
  };

  window.__player = {
    /** stops the editor's own stepping and loads an sb3 (base64) */
    async load(base64: string) {
      runtime.quit();
      vm.stopAll();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      await vm.loadProject(bytes.buffer);
      runtime.quit(); // the editor may restart it after loading
      // SVG costumes rasterize asynchronously; touching and bounds need them
      await new Promise((r) => setTimeout(r, 500));
      step();
    },
    greenFlag(runSeed: number) {
      runtime.quit();
      seed = runSeed;
      seeded = true;
      clock.manual = true;
      clock.base = clock.now - frame * STEP;
      events.says = [];
      events.broadcasts = [];
      events.stopAll = [];
      events.maxClones = 0;
      for (const [key] of held) press(key, false);
      held.clear();
      flagFrame = frame;
      vm.greenFlag();
    },
    /**
     * runs n frames; the policy steers before each frame; returns states sampled every `sample` frames.
     * Blocks that wait on the browser ("spiele Klang ganz") finish in real time, so while a script waits
     * on one, frames run at real speed; otherwise the loop only yields now and then for browser events.
     */
    // biome-ignore lint/suspicious/noExplicitAny: policy object from the test
    async frames(n: number, policy: any = { kind: 'none' }, sample = 0) {
      runtime.quit();
      clock.manual = true;
      const samples = [];
      const PROMISE_WAIT = 1; // Thread.STATUS_PROMISE_WAIT
      for (let i = 0; i < n; i++) {
        steer(policy);
        for (const t of runtime.targets) lastY.set(t.id, t.y);
        step();
        if (sample && i % sample === sample - 1) samples.push(state());
        if (runtime.threads.some((t: { status: number }) => t.status === PROMISE_WAIT))
          await new Promise((r) => setTimeout(r, STEP));
        else if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0));
      }
      hold([]);
      return samples;
    },
    /** a mouse click on stage coordinates, like a click in the stage */
    click(x: number, y: number) {
      vm.postIOData('mouse', { ...toClient(x, y), isDown: true });
      for (let i = 0; i < 3; i++) step(); // a real click lasts about 100 ms
      vm.postIOData('mouse', { ...toClient(x, y), isDown: false });
      step();
    },
    pressKeys: (keys: string[]) => hold(keys),
    state,
    events: () => JSON.parse(JSON.stringify(events)),
    /** hands time and randomness back to the editor */
    release() {
      clock.manual = false;
      seeded = false;
      vm.stopAll();
    },
  };
};

/** Chromium flags for the app pages: "spiele Klang ganz" waits for the sound to end, so audio must run without a click. */
export const BROWSER_ARGS = ['--autoplay-policy=no-user-gesture-required'];

export class Player {
  readonly page: Page;
  private readonly editor: Frame;
  private constructor(page: Page, editor: Frame) {
    this.page = page;
    this.editor = editor;
  }

  /** Opens the app without an access code (the chat stays locked, Scratch works) and installs the player. */
  static async open(page: Page, baseUrl: string): Promise<Player> {
    await page.goto(`${baseUrl}/`);
    let editor: Frame | undefined;
    for (let i = 0; i < 300 && !editor; i++) {
      editor = page.frames().find((f) => /editor\.html/.test(f.url()));
      if (!editor) await page.waitForTimeout(100);
    }
    if (!editor) throw new Error('editor iframe missing');
    await editor.waitForFunction(() => (window.ki?.vm.runtime.targets.length ?? 0) > 1, undefined, { timeout: 60_000 });
    await editor.evaluate(installPlayer);
    return new Player(page, editor);
  }

  load = (sb3: Buffer) => this.editor.evaluate((b64) => window.__player.load(b64), sb3.toString('base64'));
  greenFlag = (seed = 1) => this.editor.evaluate((s) => window.__player.greenFlag(s), seed);
  frames = (n: number, policy: Policy = { kind: 'none' }, sample = 0): Promise<StageState[]> =>
    this.editor.evaluate(([n, p, s]) => window.__player.frames(n, p, s), [n, policy, sample] as const);
  seconds = (s: number, policy?: Policy, sample = 0) => this.frames(Math.round(s * 30), policy, sample);
  click = (x: number, y: number) => this.editor.evaluate(([x, y]) => window.__player.click(x, y), [x, y] as const);
  pressKeys = (keys: string[]) => this.editor.evaluate((k) => window.__player.pressKeys(k), keys);
  state = (): Promise<StageState> => this.editor.evaluate(() => window.__player.state());
  events = (): Promise<PlayEvents> => this.editor.evaluate(() => window.__player.events());
  release = () => this.editor.evaluate(() => window.__player.release());

  /** The stage as the kid sees it. */
  async screenshot(path?: string): Promise<Buffer> {
    // the stage box: the canvas plus the variable monitors the editor draws over it
    return this.editor.locator('[class*="stage_stage_"]').first().screenshot({ path });
  }
}
