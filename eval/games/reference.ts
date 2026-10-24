// Hand-built reference games, made with the assistant's own tools on the headless VM. They are the positive
// controls of the game checks: a check that fails on these is wrong, not the game. The broken variants are
// the negative controls (each has one classic beginner bug the checks must catch).
//   node eval/games/reference.ts   writes eval/games/reference/*.sb3
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
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
  console.log(`reference games in ${dir.pathname}`);
  process.exit(0);
}
