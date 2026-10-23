// The subset of the scratch-vm API this app uses. scratch-vm ships no types; these describe the
// public VM API (plus target.blocks, which the GUI uses as well) and nothing else.

/** A block in project.json (sb3) format: inputs are [kind, block-or-primitive, shadow?] arrays. */
export interface Sb3Block {
  opcode: string;
  next?: string | null;
  parent?: string | null;
  shadow?: boolean;
  topLevel?: boolean;
  inputs?: Record<string, Sb3Input>;
  fields?: Record<string, Sb3Field>;
  mutation?: Mutation;
  x?: number;
  y?: number;
}
/** [type, value, id?]: number/text/colour primitives (4–10), broadcast (11), variable (12), list (13). */
export type Sb3Primitive = [number, string | number, (string | null)?, ...unknown[]];
export type Sb3Input = [number, string | Sb3Primitive | null, (string | Sb3Primitive | null)?];
export type Sb3Field = [string, (string | null)?] | string;
/** project.json "blocks": top-level variable/list reporters are stored as bare primitive arrays. */
export type Sb3Blocks = Record<string, Sb3Block | Sb3Primitive>;

export interface Mutation {
  tagName?: string;
  children?: unknown[];
  proccode?: string;
  argumentids?: string;
  argumentnames?: string;
  argumentdefaults?: string;
  warp?: string;
  [key: string]: unknown;
}

/** A block as the VM keeps it internally (vm.shareBlocksToTarget input). */
export interface VmBlock {
  id: string;
  opcode: string;
  next: string | null;
  parent: string | null;
  shadow: boolean;
  topLevel: boolean;
  inputs: Record<string, { name: string; block: string | null; shadow: string | null }>;
  fields: Record<string, { name: string; value: string; id?: string; variableType?: string }>;
  mutation?: Mutation;
  x?: number;
  y?: number;
}

export interface Costume {
  name: string;
  rotationCenterX?: number;
  rotationCenterY?: number;
  asset?: Asset;
}
export interface Sound {
  name: string;
}

export interface Blocks {
  _blocks: Record<string, VmBlock>;
  getBlock(id: string): VmBlock | undefined;
  getScripts(): string[];
  deleteBlock(id: string): void;
}

export interface Variable {
  name: string;
  type: string;
  value: unknown;
}

export interface Target {
  id: string;
  isOriginal: boolean;
  isStage: boolean;
  x: number;
  y: number;
  direction: number;
  size: number;
  visible: boolean;
  currentCostume: number;
  blocks: Blocks;
  variables: Record<string, Variable>;
  getName(): string;
  getCostumes(): Costume[];
  getSounds(): Sound[];
  on(event: string, listener: (target: Target) => void): void;
}

export interface Asset {
  assetId: string;
  decodeText(): string;
}

export interface Storage {
  defaultAssetId: { ImageVector: string; ImageBitmap: string; Sound: string };
  AssetType: { ImageVector: unknown };
  DataFormat: { SVG: string };
  createAsset(type: unknown, format: string, data: Uint8Array, id: string | null, generateId: boolean): Asset;
}

export interface Runtime {
  targets: Target[];
  storage: Storage;
  getTargetForStage(): Target;
  on(event: string, listener: (...args: never[]) => void): void;
  once(event: string, listener: (...args: never[]) => void): void;
}

/** Costume/backdrop metadata as passed to addCostume/addBackdrop (what the library dialogs pass). */
export interface CostumeInit {
  name: string;
  assetId: string;
  md5: string;
  asset?: Asset;
  dataFormat?: string;
  bitmapResolution?: number;
  rotationCenterX?: number;
  rotationCenterY?: number;
  skinId: null;
}

export interface VirtualMachine {
  runtime: Runtime;
  editingTarget: Target | null;
  toJSON(): string;
  loadProject(project: string | object): Promise<void>;
  shareBlocksToTarget(blocks: VmBlock[], targetId: string): Promise<void>;
  setEditingTarget(targetId: string): void;
  refreshWorkspace(): void;
  /** tells the GUI to re-read all targets; false = don't mark the project as changed */
  emitTargetsUpdate(triggerProjectChange?: boolean): void;
  greenFlag(): void;
  stopAll(): void;
  start(): void;
  quit(): void;
  addSprite(json: string): Promise<void>;
  addBackdrop(md5ext: string, backdrop: CostumeInit): Promise<void>;
  addCostume(md5ext: string, costume: CostumeInit, targetId: string): Promise<void>;
  updateSvg(costumeIndex: number, svg: string, rotationCenterX: number, rotationCenterY: number): void;
  attachStorage(storage: unknown): void;
  postIOData(device: string, data: unknown): void;
}

/** The redux store of the editor (only dispatch is used). */
export interface GuiStore {
  dispatch(action: { type: string; [key: string]: unknown }): void;
}

export const findTarget = (vm: VirtualMachine, name: unknown): Target => {
  const wanted = String(name);
  const target = vm.runtime.targets.find(
    (t) => t.isOriginal && (t.isStage ? /^(stage|bühne)$/i.test(wanted) : t.getName() === wanted),
  );
  if (!target) {
    const existing = vm.runtime.targets.filter((t) => t.isOriginal).map((t) => t.getName());
    throw new Error(`No sprite named "${wanted}". Existing: ${existing.join(', ')}`);
  }
  return target;
};
