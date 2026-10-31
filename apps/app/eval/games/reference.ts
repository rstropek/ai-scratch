// Hand-built reference games, made with the assistant's own tools on the headless VM. They are the positive
// controls of the game checks: a check that fails on these is wrong, not the game. The broken variants are
// the negative controls (each has one classic beginner bug the checks must catch).
//   node eval/games/reference.ts   writes eval/games/reference/*.sb3 (downloads the CoderDojo originals)
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import type { VirtualMachine } from '../../src/shared/scratch/vm-types.ts';
import { createAssetTools } from '../../src/shared/tools/asset-tools.ts';
import { createProjectTools } from '../../src/shared/tools/project-tools.ts';
import { runTool } from '../../src/shared/tools/tool-types.ts';
import { createVm, withStorage } from '../../test/support/headless-vm.ts';

globalThis.DOMParser ??= new JSDOM('').window.DOMParser;

type Block = Record<string, unknown>;
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

const setup = async () => {
  const vm = withStorage(await createVm());
  const tools = { ...createProjectTools(vm), ...createAssetTools(vm, { loadLibrary: async () => [] }) };
  const run = (name: string, args: object) => runTool(tools, name, args);
  // the default cat is not part of either game
  const cat = vm.runtime.targets.find((t) => !t.isStage);
  if (cat) await (vm as unknown as { deleteSprite(id: string): Promise<void> }).deleteSprite(cat.id);
  return { vm, run };
};

const sb3 = async (vm: VirtualMachine): Promise<Buffer> => {
  // without a renderer, updateSvg drops the rotation center (the browser keeps it): centre drawn costumes
  for (const t of vm.runtime.targets.filter((x) => !x.isStage)) {
    for (const c of t.getCostumes() as {
      asset?: { decodeText(): string };
      rotationCenterX?: number;
      rotationCenterY?: number;
    }[]) {
      const size = c.asset?.decodeText().match(/width="(\d+)" height="(\d+)"/);
      if (size && !c.rotationCenterX && !c.rotationCenterY) {
        c.rotationCenterX = Number(size[1]) / 2;
        c.rotationCenterY = Number(size[2]) / 2;
      }
    }
  }
  const blob = await vm.saveProjectSb3();
  return Buffer.from(await blob.arrayBuffer());
};

// --- Fangspiel ---------------------------------------------------------------------------------------

export type FangBug = 'none' | 'no-points' | 'no-lives';

export const fangspiel = async (bug: FangBug = 'none'): Promise<Buffer> => {
  const { vm, run } = await setup();
  await run('draw_sprite', {
    name: 'Korb',
    svg: svg(90, 40, '<rect x="2" y="2" width="86" height="36" rx="8" fill="#a0522d"/>'),
  });
  await run('add_scripts', {
    sprite: 'Korb',
    scripts: [
      [
        { op: 'event_whenflagclicked' },
        { op: 'motion_gotoxy', X: 0, Y: -150 },
        {
          op: 'control_forever',
          SUBSTACK: [
            {
              op: 'control_if',
              CONDITION: { op: 'sensing_keypressed', KEY_OPTION: 'right arrow' },
              SUBSTACK: [{ op: 'motion_changexby', DX: 10 }],
            },
            {
              op: 'control_if',
              CONDITION: { op: 'sensing_keypressed', KEY_OPTION: 'left arrow' },
              SUBSTACK: [{ op: 'motion_changexby', DX: -10 }],
            },
          ],
        },
      ],
    ],
  });
  await run('draw_sprite', { name: 'Apfel', svg: svg(30, 30, '<circle cx="15" cy="15" r="14" fill="red"/>') });
  const caught: Block[] = [
    ...(bug === 'no-points' ? [] : [{ op: 'data_changevariableby', VARIABLE: 'Punkte', VALUE: 1 }]),
    { op: 'control_delete_this_clone' },
  ];
  const missed: Block[] = bug === 'no-lives' ? [] : [{ op: 'data_changevariableby', VARIABLE: 'Leben', VALUE: -1 }];
  await run('add_scripts', {
    sprite: 'Apfel',
    scripts: [
      [
        { op: 'event_whenflagclicked' },
        { op: 'looks_hide' },
        { op: 'data_setvariableto', VARIABLE: 'Punkte', VALUE: 0 },
        { op: 'data_setvariableto', VARIABLE: 'Leben', VALUE: 3 },
        {
          op: 'control_repeat_until',
          CONDITION: { op: 'operator_lt', OPERAND1: { op: 'data_variable', VARIABLE: 'Leben' }, OPERAND2: 1 },
          SUBSTACK: [
            { op: 'control_create_clone_of', CLONE_OPTION: '_myself_' },
            { op: 'control_wait', DURATION: 1.5 },
          ],
        },
        { op: 'event_broadcast', BROADCAST_INPUT: 'Game Over' },
        { op: 'control_stop', STOP_OPTION: 'all' },
      ],
      [
        { op: 'control_start_as_clone' },
        { op: 'motion_gotoxy', X: { op: 'operator_random', FROM: -200, TO: 200 }, Y: 170 },
        { op: 'looks_show' },
        {
          op: 'control_repeat_until',
          CONDITION: { op: 'operator_lt', OPERAND1: { op: 'motion_yposition' }, OPERAND2: -160 },
          SUBSTACK: [
            { op: 'motion_changeyby', DY: -5 },
            {
              op: 'control_if',
              CONDITION: { op: 'sensing_touchingobject', TOUCHINGOBJECTMENU: 'Korb' },
              SUBSTACK: caught,
            },
          ],
        },
        ...missed,
        { op: 'control_delete_this_clone' },
      ],
    ],
  });
  return sb3(vm);
};

// --- Memory ------------------------------------------------------------------------------------------

export type MemoryBug = 'none' | 'same-card-twice' | 'no-flip-back';

const FACES = { Apfel: '#e53935', Banane: '#fdd835', Kirsche: '#8e24aa' } as const;
type Face = keyof typeof FACES;
/** card name, face, position: the faces are spread over the grid like after shuffling */
const CARDS: [string, Face, number, number][] = [
  ['Karte1', 'Apfel', -150, 80],
  ['Karte2', 'Banane', 0, 80],
  ['Karte3', 'Kirsche', 150, 80],
  ['Karte4', 'Banane', -150, -80],
  ['Karte5', 'Apfel', 0, -80],
  ['Karte6', 'Kirsche', 150, -80],
];

const back = svg(100, 130, '<rect x="2" y="2" width="96" height="126" rx="10" fill="#1e88e5"/>');
const face = (color: string) =>
  svg(
    100,
    130,
    `<rect x="2" y="2" width="96" height="126" rx="10" fill="white"/><circle cx="50" cy="65" r="30" fill="${color}"/>`,
  );

const costumeIs = (name: string): Block => ({
  op: 'operator_equals',
  OPERAND1: { op: 'looks_costumenumbername', NUMBER_NAME: 'name' },
  OPERAND2: name,
});

export const memory = async (bug: MemoryBug = 'none'): Promise<Buffer> => {
  const { vm, run } = await setup();
  for (const [name, f, x, y] of CARDS) {
    await run('draw_sprite', { name, costume: 'Rückseite', svg: back });
    await run('draw_costume', { sprite: name, costume: f, svg: face(FACES[f]) });
    const open =
      bug === 'same-card-twice' ? { op: 'operator_equals', OPERAND1: 1, OPERAND2: 1 } : costumeIs('Rückseite');
    await run('add_scripts', {
      sprite: name,
      scripts: [
        [
          { op: 'event_whenflagclicked' },
          { op: 'looks_switchcostumeto', COSTUME: 'Rückseite' },
          { op: 'motion_gotoxy', X: x, Y: y },
          { op: 'looks_show' },
        ],
        [
          { op: 'event_whenthisspriteclicked' },
          {
            op: 'control_if',
            CONDITION: {
              op: 'operator_and',
              OPERAND1: open,
              OPERAND2: { op: 'operator_equals', OPERAND1: { op: 'data_variable', VARIABLE: 'Sperre' }, OPERAND2: 0 },
            },
            SUBSTACK: [
              { op: 'looks_switchcostumeto', COSTUME: f },
              {
                op: 'control_if_else',
                CONDITION: {
                  op: 'operator_equals',
                  OPERAND1: { op: 'data_variable', VARIABLE: 'Erstes' },
                  OPERAND2: '',
                },
                SUBSTACK: [{ op: 'data_setvariableto', VARIABLE: 'Erstes', VALUE: f }],
                SUBSTACK2: [
                  {
                    op: 'control_if_else',
                    CONDITION: {
                      op: 'operator_equals',
                      OPERAND1: { op: 'data_variable', VARIABLE: 'Erstes' },
                      OPERAND2: f,
                    },
                    SUBSTACK: [
                      { op: 'data_changevariableby', VARIABLE: 'Punkte', VALUE: 1 },
                      { op: 'data_addtolist', LIST: 'Gefunden', ITEM: f },
                      { op: 'data_setvariableto', VARIABLE: 'Erstes', VALUE: '' },
                    ],
                    SUBSTACK2: [
                      { op: 'data_setvariableto', VARIABLE: 'Sperre', VALUE: 1 },
                      { op: 'control_wait', DURATION: 1 },
                      ...(bug === 'no-flip-back' ? [] : [{ op: 'event_broadcast', BROADCAST_INPUT: 'zudecken' }]),
                      { op: 'data_setvariableto', VARIABLE: 'Erstes', VALUE: '' },
                      { op: 'data_setvariableto', VARIABLE: 'Sperre', VALUE: 0 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        [
          { op: 'event_whenbroadcastreceived', BROADCAST_OPTION: 'zudecken' },
          {
            op: 'control_if',
            CONDITION: {
              op: 'operator_not',
              OPERAND: { op: 'data_listcontainsitem', LIST: 'Gefunden', ITEM: f },
            },
            SUBSTACK: [{ op: 'looks_switchcostumeto', COSTUME: 'Rückseite' }],
          },
        ],
      ],
    });
  }
  await run('add_scripts', {
    sprite: 'Stage',
    scripts: [
      [
        { op: 'event_whenflagclicked' },
        { op: 'data_setvariableto', VARIABLE: 'Punkte', VALUE: 0 },
        { op: 'data_setvariableto', VARIABLE: 'Erstes', VALUE: '' },
        { op: 'data_setvariableto', VARIABLE: 'Sperre', VALUE: 0 },
        { op: 'data_deletealloflist', LIST: 'Gefunden' },
        {
          op: 'control_wait_until',
          CONDITION: { op: 'operator_equals', OPERAND1: { op: 'data_variable', VARIABLE: 'Punkte' }, OPERAND2: 3 },
        },
        { op: 'event_broadcast', BROADCAST_INPUT: 'gewonnen' },
      ],
    ],
  });
  // a winner sprite that says so
  await run('draw_sprite', { name: 'Pokal', svg: svg(60, 60, '<circle cx="30" cy="30" r="28" fill="gold"/>') });
  await run('add_scripts', {
    sprite: 'Pokal',
    scripts: [
      [{ op: 'event_whenflagclicked' }, { op: 'looks_hide' }, { op: 'motion_gotoxy', X: 0, Y: 0 }],
      [
        { op: 'event_whenbroadcastreceived', BROADCAST_OPTION: 'gewonnen' },
        { op: 'looks_show' },
        { op: 'looks_say', MESSAGE: 'Gewonnen!' },
      ],
    ],
  });
  return sb3(vm);
};

/** Memory the way the assistant tends to build it: one sprite, six clones, positions and pictures shuffled. */
export const memoryClones = async (): Promise<Buffer> => {
  const { vm, run } = await setup();
  await run('draw_sprite', { name: 'Karte', costume: 'Rückseite', svg: back });
  for (const f of Object.keys(FACES) as Face[])
    await run('draw_costume', { sprite: 'Karte', costume: f, svg: face(FACES[f]) });
  const card = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === 'Karte');
  // clones keep their own copy of sprite-local variables
  card?.createVariable('bild-local', 'Bild', '');
  card?.createVariable('nr-local', 'MeineNr', '');
  const v = (name: string): Block => ({ op: 'data_variable', VARIABLE: name });
  await run('add_scripts', {
    sprite: 'Karte',
    scripts: [
      [
        { op: 'event_whenflagclicked' },
        { op: 'looks_hide' },
        { op: 'looks_switchcostumeto', COSTUME: 'Rückseite' },
        { op: 'data_setvariableto', VARIABLE: 'Punkte', VALUE: 0 },
        { op: 'data_setvariableto', VARIABLE: 'Erstes', VALUE: '' },
        { op: 'data_setvariableto', VARIABLE: 'Sperre', VALUE: 0 },
        { op: 'data_deletealloflist', LIST: 'Gefunden' },
        { op: 'data_deletealloflist', LIST: 'Bilder' },
        ...['Apfel', 'Apfel', 'Banane', 'Banane', 'Kirsche', 'Kirsche'].map((f) => ({
          op: 'data_addtolist',
          LIST: 'Bilder',
          ITEM: f,
        })),
        { op: 'data_setvariableto', VARIABLE: 'MeineNr', VALUE: 0 },
        {
          op: 'control_repeat',
          TIMES: 6,
          SUBSTACK: [
            { op: 'data_changevariableby', VARIABLE: 'MeineNr', VALUE: 1 },
            {
              op: 'data_setvariableto',
              VARIABLE: 'Idx',
              VALUE: { op: 'operator_random', FROM: 1, TO: { op: 'data_lengthoflist', LIST: 'Bilder' } },
            },
            {
              op: 'data_setvariableto',
              VARIABLE: 'Bild',
              VALUE: { op: 'data_itemoflist', LIST: 'Bilder', INDEX: v('Idx') },
            },
            { op: 'data_deleteoflist', LIST: 'Bilder', INDEX: v('Idx') },
            {
              op: 'motion_gotoxy',
              X: {
                op: 'operator_subtract',
                NUM1: {
                  op: 'operator_multiply',
                  NUM1: { op: 'operator_mod', NUM1: { op: 'operator_subtract', NUM1: v('MeineNr'), NUM2: 1 }, NUM2: 3 },
                  NUM2: 150,
                },
                NUM2: 150,
              },
              Y: {
                op: 'operator_subtract',
                NUM1: 80,
                NUM2: {
                  op: 'operator_multiply',
                  NUM1: {
                    op: 'operator_mathop',
                    OPERATOR: 'floor',
                    NUM: {
                      op: 'operator_divide',
                      NUM1: { op: 'operator_subtract', NUM1: v('MeineNr'), NUM2: 1 },
                      NUM2: 3,
                    },
                  },
                  NUM2: 160,
                },
              },
            },
            { op: 'control_create_clone_of', CLONE_OPTION: '_myself_' },
          ],
        },
        { op: 'control_wait_until', CONDITION: { op: 'operator_equals', OPERAND1: v('Punkte'), OPERAND2: 3 } },
        { op: 'event_broadcast', BROADCAST_INPUT: 'gewonnen' },
      ],
      [{ op: 'control_start_as_clone' }, { op: 'looks_show' }],
      [
        { op: 'event_whenthisspriteclicked' },
        {
          op: 'control_if',
          CONDITION: {
            op: 'operator_and',
            OPERAND1: costumeIs('Rückseite'),
            OPERAND2: { op: 'operator_equals', OPERAND1: v('Sperre'), OPERAND2: 0 },
          },
          SUBSTACK: [
            { op: 'looks_switchcostumeto', COSTUME: v('Bild') },
            {
              op: 'control_if_else',
              CONDITION: { op: 'operator_equals', OPERAND1: v('Erstes'), OPERAND2: '' },
              SUBSTACK: [{ op: 'data_setvariableto', VARIABLE: 'Erstes', VALUE: v('Bild') }],
              SUBSTACK2: [
                {
                  op: 'control_if_else',
                  CONDITION: { op: 'operator_equals', OPERAND1: v('Erstes'), OPERAND2: v('Bild') },
                  SUBSTACK: [
                    { op: 'data_changevariableby', VARIABLE: 'Punkte', VALUE: 1 },
                    { op: 'data_addtolist', LIST: 'Gefunden', ITEM: v('Bild') },
                    { op: 'data_setvariableto', VARIABLE: 'Erstes', VALUE: '' },
                  ],
                  SUBSTACK2: [
                    { op: 'data_setvariableto', VARIABLE: 'Sperre', VALUE: 1 },
                    { op: 'control_wait', DURATION: 1 },
                    { op: 'event_broadcast', BROADCAST_INPUT: 'zudecken' },
                    { op: 'data_setvariableto', VARIABLE: 'Erstes', VALUE: '' },
                    { op: 'data_setvariableto', VARIABLE: 'Sperre', VALUE: 0 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      [
        { op: 'event_whenbroadcastreceived', BROADCAST_OPTION: 'zudecken' },
        {
          op: 'control_if',
          CONDITION: {
            op: 'operator_not',
            OPERAND: { op: 'data_listcontainsitem', LIST: 'Gefunden', ITEM: v('Bild') },
          },
          SUBSTACK: [{ op: 'looks_switchcostumeto', COSTUME: 'Rückseite' }],
        },
      ],
    ],
  });
  await run('draw_sprite', { name: 'Pokal', svg: svg(60, 60, '<circle cx="30" cy="30" r="28" fill="gold"/>') });
  await run('add_scripts', {
    sprite: 'Pokal',
    scripts: [
      [{ op: 'event_whenflagclicked' }, { op: 'looks_hide' }, { op: 'motion_gotoxy', X: 0, Y: 0 }],
      [
        { op: 'event_whenbroadcastreceived', BROADCAST_OPTION: 'gewonnen' },
        { op: 'looks_show' },
        { op: 'looks_say', MESSAGE: 'Gewonnen!' },
      ],
    ],
  });
  return sb3(vm);
};

// --- CoderDojo classics ------------------------------------------------------------------------------
// The finished projects of the CoderDojo Linz exercises are the working references. Each broken copy changes
// one value in project.json, so one check (or extra) must fail.

const CODERDOJO = 'https://linz.coderdojo.net/uebungsanleitungen/programmieren/scratch';
interface RawBlock {
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs: Record<string, unknown[]>;
  fields: Record<string, unknown[]>;
  mutation?: { proccode?: string };
}
interface RawProject {
  targets: { name: string; blocks: Record<string, RawBlock | unknown[]>; variables: Record<string, unknown[]> }[];
}

const download = async (game: string): Promise<Buffer> => {
  const res = await fetch(`${CODERDOJO}/${game}/${game}.sb3`);
  if (!res.ok) throw new Error(`download ${game}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

const mutate = async (sb3: Buffer, change: (project: RawProject) => void): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(sb3);
  const project = JSON.parse((await zip.file('project.json')?.async('string')) ?? '{}') as RawProject;
  change(project);
  zip.file('project.json', JSON.stringify(project));
  return zip.generateAsync({ type: 'nodebuffer' });
};

/** The one block of a sprite that matches; throws if there is none (the original changed). */
const block = (p: RawProject, sprite: string, match: (b: RawBlock, parent?: RawBlock) => boolean): RawBlock => {
  const blocks = p.targets.find((t) => t.name === sprite)?.blocks ?? {};
  const all = Object.values(blocks).filter((b): b is RawBlock => !Array.isArray(b));
  const found = all.find((b) => match(b, b.parent ? (blocks[b.parent] as RawBlock) : undefined));
  if (!found) throw new Error(`no such block in ${sprite}`);
  return found;
};
/** Takes a block without block inputs out of its script. */
const unlink = (p: RawProject, sprite: string, b: RawBlock) => {
  const blocks = p.targets.find((t) => t.name === sprite)?.blocks as Record<string, RawBlock>;
  const id = Object.keys(blocks).find((k) => blocks[k] === b) as string;
  const parent = b.parent ? blocks[b.parent] : undefined;
  if (parent?.next === id) parent.next = b.next;
  else if (parent) for (const input of Object.values(parent.inputs)) if (input[1] === id) input[1] = b.next;
  if (b.next) (blocks[b.next] as RawBlock).parent = b.parent;
  delete blocks[id];
};
const setNumber = (b: RawBlock, input: string, value: number) => {
  (b.inputs[input] as [number, [number, unknown]])[1][1] = value;
};
/** The VM finds a message by its id first, so both change. */
const setBroadcast = (b: RawBlock, name: string) => {
  const menu = (b.inputs.BROADCAST_INPUT as [number, unknown[]])[1];
  menu[1] = name;
  menu[2] = `${name}-id`;
};
const varIs = (b: RawBlock, name: string) => b.fields.VARIABLE?.[0] === name;

export const coderdojo = async (): Promise<Record<string, Buffer>> => {
  const fang = await download('fang-mich');
  const space = await download('space-shooter');
  // the original picks bomb positions from 0 to 99, but list items start at 1: a bomb at 0 is lost, and a
  // game with fewer bombs than anzahlBomben can never be won. The reference picks from 1 to 100.
  const mines = await mutate(await download('minesweeper'), (p) => {
    const blocks = p.targets.find((t) => t.name === 'Zelle')?.blocks ?? {};
    for (const b of Object.values(blocks))
      if (!Array.isArray(b) && (b as RawBlock).opcode === 'operator_random') {
        setNumber(b as RawBlock, 'FROM', 1);
        setNumber(b as RawBlock, 'TO', 100);
      }
  });
  return {
    'fang-mich': fang,
    // the shark only turns
    'fang-mich-lazy-shark': await mutate(fang, (p) =>
      setNumber(
        block(p, 'Hai', (b) => b.opcode === 'motion_movesteps'),
        'STEPS',
        0,
      ),
    ),
    'fang-mich-no-up': await mutate(fang, (p) => {
      block(p, 'Fisch', (b) => b.fields.KEY_OPTION?.[0] === 'up arrow').fields.KEY_OPTION = ['u', null];
    }),
    'fang-mich-no-catch': await mutate(fang, (p) => {
      block(p, 'Fisch', (b) => b.opcode === 'sensing_touchingobjectmenu').fields.TOUCHINGOBJECTMENU = ['Krake', null];
    }),
    'fang-mich-no-comeback': await mutate(fang, (p) => {
      block(p, 'Fisch', (b, parent) => b.opcode === 'looks_show' && parent?.opcode === 'control_wait').opcode =
        'looks_hide';
    }),
    // the green flag doesn't put the fish back
    'fang-mich-no-restart': await mutate(fang, (p) =>
      unlink(
        p,
        'Fisch',
        block(p, 'Fisch', (b, parent) => b.opcode === 'motion_gotoxy' && parent?.opcode === 'event_whenflagclicked'),
      ),
    ),
    'space-shooter': space,
    'space-shooter-no-points': await mutate(space, (p) =>
      setNumber(
        block(p, 'Meteorit', (b) => b.opcode === 'data_changevariableby' && varIs(b, 'Anzahl Treffer')),
        'VALUE',
        0,
      ),
    ),
    // the laser stays at the ship
    'space-shooter-no-laser': await mutate(space, (p) =>
      setNumber(
        block(p, 'Laser', (b) => b.opcode === 'motion_movesteps'),
        'STEPS',
        0,
      ),
    ),
    'space-shooter-no-game-over': await mutate(space, (p) => {
      block(p, 'Raumschiff', (b) => b.opcode === 'sensing_touchingobjectmenu').fields.TOUCHINGOBJECTMENU = [
        'Krake',
        null,
      ];
    }),
    'space-shooter-constant-speed': await mutate(space, (p) => {
      for (const name of ['Meteroitengeschwindigkeit', 'Meteroitenentstehungszeit'])
        setNumber(
          block(p, 'Meteorit', (b) => b.opcode === 'data_changevariableby' && varIs(b, name)),
          'VALUE',
          0,
        );
    }),
    // the hits are not reset to 0
    'space-shooter-no-restart': await mutate(space, (p) =>
      unlink(
        p,
        'Meteorit',
        block(p, 'Meteorit', (b) => b.opcode === 'data_setvariableto' && varIs(b, 'Anzahl Treffer')),
      ),
    ),
    minesweeper: mines,
    // the small version's checks are a subset: the full game must pass them
    'minesweeper-mini': mines,
    // a 1 shows the costume of a 2
    'minesweeper-wrong-numbers': await mutate(mines, (p) => {
      block(p, 'Zelle', (b) => b.opcode === 'looks_costume' && b.fields.COSTUME?.[0] === '1').fields.COSTUME = [
        '2',
        null,
      ];
    }),
    'minesweeper-no-lose': await mutate(mines, (p) =>
      setBroadcast(
        block(p, 'Zelle', (b) => b.opcode === 'event_broadcast' && JSON.stringify(b.inputs).includes('"verloren"')),
        'nichts',
      ),
    ),
    'minesweeper-no-win': await mutate(mines, (p) =>
      setBroadcast(
        block(p, 'Zelle', (b) => b.opcode === 'event_broadcast' && JSON.stringify(b.inputs).includes('"gewonnen"')),
        'nichts',
      ),
    ),
    'minesweeper-no-cascade': await mutate(mines, (p) =>
      unlink(
        p,
        'Zelle',
        block(
          p,
          'Zelle',
          (b, parent) =>
            b.opcode === 'procedures_call' &&
            b.mutation?.proccode === 'UmliegendeZellenAufdecken' &&
            parent?.opcode === 'looks_switchcostumeto',
        ),
      ),
    ),
  };
};

if (import.meta.main) {
  const dir = new URL('./reference/', import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const write = async (name: string, data: Promise<Buffer>) =>
    fs.writeFileSync(new URL(`${name}.sb3`, dir), await data);
  await write('fangspiel', fangspiel());
  await write('fangspiel-no-points', fangspiel('no-points'));
  await write('fangspiel-no-lives', fangspiel('no-lives'));
  await write('memory', memory());
  await write('memory-clones', memoryClones());
  await write('memory-same-card-twice', memory('same-card-twice'));
  await write('memory-no-flip-back', memory('no-flip-back'));
  for (const [name, data] of Object.entries(await coderdojo())) await write(name, Promise.resolve(data));
  console.log(`reference games in ${dir.pathname}`);
  process.exit(0);
}
