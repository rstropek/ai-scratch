// Tools that add pictures: Scratch library items (sprites, backdrops, costumes) and SVG drawn by the model.
// Only public scratch-vm API: addSprite (like the sprite library), addBackdrop / addCostume (like the
// backdrop/costume library) and updateSvg (what the paint editor calls after each edit).
import { findTarget, type Target, type VirtualMachine } from '../scratch/vm-types.ts';
import { fn, optionalStringArg, stringArg, type ToolDefinition, type ToolHandlers } from './tool-types.ts';

export type LibraryKind = 'sprite' | 'backdrop' | 'costume';
const KINDS: Record<LibraryKind, string> = { sprite: 'sprites', backdrop: 'backdrops', costume: 'costumes' };
const isKind = (kind: unknown): kind is LibraryKind => typeof kind === 'string' && Object.hasOwn(KINDS, kind);

/** An entry of @scratch/scratch-gui's dist/libraries/*.json (costumes and backdrops have md5ext etc.). */
export interface LibraryItem {
  name: string;
  tags: string[];
  assetId?: string;
  md5ext?: string;
  dataFormat?: string;
  rotationCenterX?: number;
  rotationCenterY?: number;
  bitmapResolution?: number;
  costumes?: { name: string }[];
  sounds?: { name: string }[];
  [key: string]: unknown;
}
export type LoadLibrary = (kind: LibraryKind) => Promise<LibraryItem[]>;

const MAX_SVG = 30000;
const svgDescription = (size: string) =>
  `SVG source. viewBox="0 0 W H" with width/height = viewBox size, ${size}. ` +
  'Use only path, rect, circle, ellipse, polygon, polyline, line, g with fill/stroke attributes ' +
  '(linearGradient/radialGradient ok). No <style>/CSS, no <text>, no <image>, no filters, no scripts.';

export const assetToolDefinitions: ToolDefinition[] = [
  fn(
    'search_library',
    'Searches the Scratch library by English words (name or tags, e.g. "bat", "space", "underwater"). ' +
      'Returns matching item names; sprites also list their costumes and sounds.',
    {
      kind: { type: 'string', enum: Object.keys(KINDS) },
      query: { type: 'string', description: 'English search words' },
    },
    ['kind', 'query'],
  ),
  fn(
    'add_library_sprite',
    'Adds a sprite from the Scratch library (exact name from search_library). Returns the name it got in the project.',
    { name: { type: 'string' } },
    ['name'],
  ),
  fn(
    'add_library_backdrop',
    'Adds a backdrop from the Scratch library to the stage and switches to it.',
    { name: { type: 'string' } },
    ['name'],
  ),
  fn(
    'add_library_costume',
    'Adds a costume from the Scratch library to a sprite. The sprite keeps its current costume.',
    { sprite: { type: 'string' }, name: { type: 'string' } },
    ['sprite', 'name'],
  ),
  fn(
    'draw_sprite',
    'Creates a new sprite whose first costume is the given SVG drawing (like painting a new sprite).',
    {
      name: { type: 'string', description: 'sprite name' },
      costume: { type: 'string', description: 'costume name' },
      svg: {
        type: 'string',
        description: svgDescription('a typical sprite is 40-150 units; the rotation center is the middle'),
      },
    },
    ['name', 'svg'],
  ),
  fn(
    'draw_costume',
    'Adds an SVG drawing as a new costume to a sprite, or as a new backdrop when sprite is "Stage". ' +
      'A costume with the same name is redrawn in place: to change a drawing, reuse its name instead of adding a new costume. ' +
      'A sprite keeps its current costume (a script switches to the new one); a new backdrop is shown at once.',
    {
      sprite: { type: 'string' },
      costume: { type: 'string', description: 'costume/backdrop name' },
      svg: {
        type: 'string',
        description: svgDescription(
          'a backdrop is exactly 480x360, a sprite costume usually 40-150 units; to match the other costumes, use their size from the project',
        ),
      },
    },
    ['sprite', 'costume', 'svg'],
  ),
];

export const assetToolsPrompt =
  'Bilder: Für Figuren und Hintergründe suche zuerst in der Scratch-Bibliothek (search_library, englische Suchwörter). ' +
  'Nur wenn das Kind ausdrücklich eine eigene Zeichnung will oder nichts Passendes da ist, zeichne selbst (draw_sprite, draw_costume): ' +
  'einfache, kräftige Formen im Cartoon-Stil wie Scratch-Figuren, die Bühne ist 480x360.';

/** Loads dist/libraries/*.json of @scratch/scratch-gui, which the web server serves at /libraries/. */
export const fetchLibrary: LoadLibrary = async (kind) => {
  const response = await fetch(`/libraries/${KINDS[kind]}.json`);
  if (!response.ok) throw new Error(`Could not load the ${kind} library (HTTP ${response.status})`);
  return (await response.json()) as LibraryItem[];
};

const tokens = (s: unknown) =>
  String(s)
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/)
    .filter(Boolean);

export const searchLibrary = (items: LibraryItem[], query: string, limit = 12): LibraryItem[] => {
  const words = tokens(query).map((w) => (w.length > 3 ? w.replace(/s$/, '') : w)); // "bats" finds "Bat"
  const score = (item: LibraryItem) => {
    const name = item.name.toLowerCase();
    const tags = item.tags.map((t) => t.toLowerCase());
    return words.reduce(
      (sum, w) =>
        sum +
        (name === w ? 5 : 0) +
        (tokens(name).includes(w) ? 3 : name.includes(w) ? 1 : 0) +
        (tags.includes(w) ? 2 : tags.some((t) => t.includes(w)) ? 1 : 0),
      0,
    );
  };
  return items
    .map((item) => ({ item, s: score(item) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
};

const svgSize = (svg: string): [number, number] => {
  const viewBox = svg.match(/viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/);
  if (viewBox) return [Number(viewBox[3]), Number(viewBox[4])];
  const num = (attr: string) => Number(svg.match(new RegExp(`<svg[^>]*\\s${attr}\\s*=\\s*["']([\\d.]+)`))?.[1]);
  return [num('width'), num('height')];
};

/** Models sometimes wrap the SVG in a code fence or leave a stray character after </svg>. */
export const extractSvg = (svg: unknown): string => {
  const text = String(svg ?? '');
  return text.match(/<svg[\s>][\s\S]*<\/svg>/)?.[0] ?? text;
};

/** Cheap checks with messages the model can act on; the editor's SVG loader sanitizes the rest. */
export const checkSvg = (svg: string): [number, number] => {
  const errors: string[] = [];
  if (!/<svg[\s>]/.test(svg) || !/<\/svg>\s*$/.test(svg.trim())) errors.push('svg must be one <svg>…</svg> element');
  else {
    if (svg.length > MAX_SVG) errors.push(`svg is ${svg.length} characters, keep it under ${MAX_SVG}`);
    for (const tag of ['script', 'image', 'foreignObject', 'style', 'text', 'filter']) {
      if (new RegExp(`<${tag}[\\s>/]`, 'i').test(svg)) errors.push(`<${tag}> is not supported`);
    }
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const error = doc.getElementsByTagName('parsererror')[0];
      // Chrome wraps the message in "This page contains the following errors: … Below is a rendering …"
      if (error) {
        const message = (error.textContent ?? '').replace(/^[^:]*errors:|Below is a rendering[\s\S]*$/g, '').trim();
        errors.push(`not valid XML: ${message.slice(0, 200)}`);
      }
    }
    const [w, h] = svgSize(svg);
    if (!(w > 0 && h > 0)) errors.push('svg needs a viewBox="0 0 W H" (or width and height)');
    else if (w > 2000 || h > 2000) errors.push(`svg is ${w}x${h}, the stage is only 480x360`);
  }
  if (errors.length) throw new Error(`Nothing was drawn, please fix:\n- ${errors.join('\n- ')}`);
  return svgSize(svg);
};

// scratch-vm rejects with undefined or strings when an asset can't be loaded (e.g. CDN not reachable)
const loading = <T>(what: string, promise: Promise<T>): Promise<T> =>
  promise.catch((e: unknown) => {
    const reason = e instanceof Error ? e.message : (e ?? 'asset not reachable');
    throw new Error(`Could not load ${what}: ${String(reason)}`);
  });

const currentCostume = (t: Target) => t.getCostumes()[t.currentCostume]?.name;

/**
 * scratch-vm switches a target to a costume it adds. A new backdrop should show, but a sprite's costume
 * is its starting look (and that of its clones): a "Bombe" costume made every Minesweeper cell a bomb.
 */
const keepCostume = async (target: Target, add: () => Promise<unknown>) => {
  const before = target.currentCostume;
  await add();
  if (!target.isStage) target.setCostume(before);
};

const describeSprite = (t: Target) => ({
  name: t.getName(),
  x: t.x,
  y: t.y,
  costumes: t.getCostumes().map((c) => c.name),
  sounds: t.getSounds().map((s) => s.name),
});

export const createAssetTools = (
  vm: VirtualMachine,
  { loadLibrary = fetchLibrary }: { loadLibrary?: LoadLibrary } = {},
): ToolHandlers => {
  const libraries = new Map<LibraryKind, Promise<LibraryItem[]>>();
  const library = (kind: LibraryKind) => {
    let items = libraries.get(kind);
    if (!items) {
      items = loadLibrary(kind);
      libraries.set(kind, items);
      items.catch(() => libraries.delete(kind)); // retry on the next call
    }
    return items;
  };
  const libraryItem = async (kind: LibraryKind, name: string) => {
    const items = await library(kind);
    const item = items.find((i) => i.name === name) ?? items.find((i) => i.name.toLowerCase() === name.toLowerCase());
    if (!item) {
      const similar = searchLibrary(items, name, 5).map((i) => i.name);
      throw new Error(
        `No ${kind} "${name}" in the library.${similar.length ? ` Similar: ${similar.join(', ')}` : ' Use search_library.'}`,
      );
    }
    return item;
  };
  const addSprite = async (json: { name?: unknown; [key: string]: unknown }): Promise<Target> => {
    const before = new Set(vm.runtime.targets);
    // random spot like the GUI's randomizeSpritePosition, so it doesn't hide behind the cat
    const position = { x: Math.floor(200 * Math.random() - 100), y: Math.floor(100 * Math.random() - 50) };
    await loading(`sprite ${json.name}`, vm.addSprite(JSON.stringify({ ...json, ...position })));
    const added = vm.runtime.targets.find((t) => t.isOriginal && !before.has(t));
    if (!added) throw new Error(`Sprite ${json.name} was not added`);
    return added; // also vm.editingTarget: the editor shows the new sprite
  };
  const costumeInit = (item: LibraryItem) => {
    if (!item.assetId || !item.md5ext) throw new Error(`Library item ${item.name} has no asset`);
    const { name, rotationCenterX, rotationCenterY, bitmapResolution } = item;
    // like the library dialogs, plus md5 (it stays unset otherwise and the costume serializes without md5ext)
    return {
      md5ext: item.md5ext,
      init: {
        name,
        assetId: item.assetId,
        md5: item.md5ext,
        rotationCenterX,
        rotationCenterY,
        bitmapResolution,
        skinId: null,
      },
    };
  };

  return {
    search_library: async (args) => {
      const kind = args.kind;
      if (!isKind(kind)) throw new Error(`kind must be one of ${Object.keys(KINDS).join(', ')}`);
      const found = searchLibrary(await library(kind), stringArg(args, 'query'));
      if (!found.length) return { found: [], hint: 'Nothing found. Try other or more general English words.' };
      return {
        found: found.map((i) =>
          kind === 'sprite'
            ? {
                name: i.name,
                tags: i.tags,
                costumes: (i.costumes ?? []).map((c) => c.name),
                sounds: (i.sounds ?? []).map((s) => s.name),
              }
            : { name: i.name, tags: i.tags },
        ),
      };
    },
    add_library_sprite: async (args) => {
      const item = await libraryItem('sprite', stringArg(args, 'name'));
      // same as the sprite library dialog; scratch-vm renames it ("Bat2") if the name is taken
      return { ok: true, sprite: describeSprite(await addSprite(item)) };
    },
    add_library_backdrop: async (args) => {
      const item = await libraryItem('backdrop', stringArg(args, 'name'));
      const { md5ext, init } = costumeInit(item);
      await loading(`backdrop ${item.name}`, vm.addBackdrop(md5ext, init));
      return {
        ok: true,
        backdrops: vm.runtime
          .getTargetForStage()
          .getCostumes()
          .map((c) => c.name),
      };
    },
    add_library_costume: async (args) => {
      const target = findTarget(vm, stringArg(args, 'sprite'));
      const item = await libraryItem('costume', stringArg(args, 'name'));
      const { md5ext, init } = costumeInit(item);
      await keepCostume(target, () => loading(`costume ${item.name}`, vm.addCostume(md5ext, init, target.id)));
      return { ok: true, costumes: target.getCostumes().map((c) => c.name), current: currentCostume(target) };
    },
    draw_sprite: async (args) => {
      const svg = extractSvg(args.svg);
      const [w, h] = checkSvg(svg);
      const placeholder = vm.runtime.storage.defaultAssetId.ImageVector; // built-in empty SVG
      const target = await addSprite({
        isStage: false,
        name: optionalStringArg(args, 'name') ?? 'Figur',
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        sounds: [],
        costumes: [
          {
            name: optionalStringArg(args, 'costume') ?? 'Kostüm1',
            assetId: placeholder,
            md5ext: `${placeholder}.svg`,
            dataFormat: 'svg',
            bitmapResolution: 1,
            rotationCenterX: 0,
            rotationCenterY: 0,
          },
        ],
      });
      vm.setEditingTarget(target.id);
      vm.updateSvg(0, svg, w / 2, h / 2); // exactly what the paint editor does
      // The GUI renders sprite thumbnails throttled and misses this update: the new sprite keeps the
      // "?" placeholder in the sprite list. Measured: a repeated update >= 500 ms later fixes it.
      for (const ms of [600, 1500]) setTimeout(() => vm.emitTargetsUpdate(false), ms);
      return { ok: true, sprite: target.getName(), size: [w, h], x: target.x, y: target.y };
    },
    draw_costume: async (args) => {
      const svg = extractSvg(args.svg);
      const [w, h] = checkSvg(svg);
      const target = findTarget(vm, stringArg(args, 'sprite'));
      const name = stringArg(args, 'costume');
      const index = target.getCostumes().findIndex((c) => c.name === name);
      if (index >= 0) {
        // redraw in place, like the paint editor (it works on the editing target)
        const editing = vm.editingTarget;
        vm.setEditingTarget(target.id);
        await vm.updateSvg(index, svg, w / 2, h / 2);
        if (editing && editing.id !== target.id) vm.setEditingTarget(editing.id);
        for (const ms of [600, 1500]) setTimeout(() => vm.emitTargetsUpdate(false), ms); // thumbnails, see above
        return { ok: true, redrawn: name, costumes: target.getCostumes().map((c) => c.name), size: [w, h] };
      }
      const storage = vm.runtime.storage;
      const asset = storage.createAsset(
        storage.AssetType.ImageVector,
        storage.DataFormat.SVG,
        new TextEncoder().encode(svg),
        null,
        true,
      );
      await keepCostume(target, () =>
        vm.addCostume(
          `${asset.assetId}.svg`,
          {
            name,
            asset,
            assetId: asset.assetId,
            md5: `${asset.assetId}.svg`,
            dataFormat: 'svg',
            bitmapResolution: 1,
            rotationCenterX: w / 2,
            rotationCenterY: h / 2,
            skinId: null,
          },
          target.id,
        ),
      );
      return {
        ok: true,
        costumes: target.getCostumes().map((c) => c.name),
        current: currentCostume(target),
        size: [w, h],
      };
    },
  };
};
