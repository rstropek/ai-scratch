import {
  Bot,
  HandCoins,
  Key,
  KeyRound,
  type LucideIcon,
  PiggyBank,
  ShieldCheck,
  Smile,
  Ticket,
  UserRound,
} from 'lucide-react';
import { useId } from 'react';
import { cx } from './ui/cx.ts';

// The diagram of the access system on /access: who and what is involved between a donor's credit and a kid's
// answer, hand-placed. The texts come from content/access.tsx; this file only knows the geometry.

export type MapNodeId = 'donor' | 'pool' | 'free' | 'adult' | 'openrouter' | 'code' | 'kid' | 'server' | 'claude';
export type MapEdgeId =
  | 'donor-pool'
  | 'pool-free'
  | 'free-code'
  | 'adult-code'
  | 'adult-openrouter'
  | 'openrouter-code'
  | 'code-kid'
  | 'kid-server'
  | 'server-claude'
  | 'pool-server'
  | 'openrouter-server';

export interface MapNodeText {
  title: string;
  sub: string;
  /** the sub line is an example code */
  mono?: boolean;
}

type Point = readonly [x: number, y: number];

export interface MapLayout {
  width: number;
  height: number;
  node: { width: number; height: number };
  nodes: Record<MapNodeId, Point>;
  /** each edge as the corners of its line, from its start to the arrow's tip on the target's edge */
  edges: Partial<Record<MapEdgeId, readonly Point[]>>;
}

/** edges along which a key travels to the server: dashed, they are not part of the money's way */
const KEY_EDGES: ReadonlySet<MapEdgeId> = new Set(['pool-server', 'openrouter-server']);

const icons: Record<MapNodeId, LucideIcon> = {
  donor: HandCoins,
  pool: KeyRound,
  free: PiggyBank,
  adult: UserRound,
  openrouter: Key,
  code: Ticket,
  kid: Smile,
  server: ShieldCheck,
  claude: Bot,
};

// two columns of 156 × 68 boxes in five rows and a lane on the right, narrow enough for a phone and for the column beside the text
export const mapLayout: MapLayout = {
  width: 376,
  height: 492,
  node: { width: 156, height: 68 },
  nodes: {
    donor: [12, 12],
    pool: [192, 12],
    adult: [12, 112],
    free: [192, 112],
    openrouter: [12, 212],
    code: [192, 212],
    server: [12, 312],
    kid: [192, 312],
    claude: [12, 412],
  },
  edges: {
    'donor-pool': [
      [168, 46],
      [192, 46],
    ],
    'pool-free': [
      [270, 80],
      [270, 112],
    ],
    'free-code': [
      [270, 180],
      [270, 212],
    ],
    'adult-code': [
      [168, 146],
      [180, 146],
      [180, 226],
      [192, 226],
    ],
    'adult-openrouter': [
      [90, 180],
      [90, 212],
    ],
    'openrouter-code': [
      [168, 262],
      [192, 262],
    ],
    'code-kid': [
      [270, 280],
      [270, 312],
    ],
    'kid-server': [
      [192, 346],
      [168, 346],
    ],
    'server-claude': [
      [90, 380],
      [90, 412],
    ],
    'openrouter-server': [
      [90, 280],
      [90, 312],
    ],
    // around the right side, then between the third and fourth row into the server's top
    'pool-server': [
      [348, 30],
      [364, 30],
      [364, 296],
      [130, 296],
      [130, 312],
    ],
  },
};

/** An SVG path through the points with rounded corners. */
export function roundedPath(points: readonly Point[], radius = 8): string {
  const [first] = points;
  if (!first) return '';
  let d = `M${first[0]},${first[1]}`;
  for (let i = 1; i < points.length; i++) {
    const corner = points[i];
    const before = points[i - 1];
    const after = points[i + 1];
    if (!corner || !before) continue;
    if (!after) {
      d += ` L${corner[0]},${corner[1]}`;
      continue;
    }
    const r = Math.min(radius, distance(before, corner) / 2, distance(corner, after) / 2);
    const [ax, ay] = toward(corner, before, r);
    const [bx, by] = toward(corner, after, r);
    d += ` L${ax},${ay} Q${corner[0]},${corner[1]} ${bx},${by}`;
  }
  return d;
}

const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** the point `length` away from `from` in the direction of `to` */
function toward(from: Point, to: Point, length: number): Point {
  const total = distance(from, to);
  return [from[0] + ((to[0] - from[0]) / total) * length, from[1] + ((to[1] - from[1]) / total) * length];
}

/** The diagram: the active nodes filled, the active edges drawn on in Scratch's purple. */
export function AccessMap({
  texts,
  label,
  activeNodes,
  activeEdges,
  className,
}: {
  texts: Record<MapNodeId, MapNodeText>;
  /** what the diagram shows, for screen readers */
  label: string;
  activeNodes: readonly MapNodeId[];
  activeEdges: readonly MapEdgeId[];
  className?: string;
}) {
  const id = useId();
  const layout = mapLayout;
  const arrowOff = `${id}-off`;
  const arrowOn = `${id}-on`;
  const { width, height } = layout.node;
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={label}
      className={cx('h-auto w-full', className)}
    >
      <defs>
        {[
          [arrowOff, 'fill-neutral'],
          [arrowOn, 'fill-primary'],
        ].map(([markerId, fill]) => (
          <marker
            key={markerId}
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="9"
            markerHeight="9"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M0,1 L9,5 L0,9 z" className={fill} />
          </marker>
        ))}
      </defs>
      {(Object.entries(layout.edges) as [MapEdgeId, readonly Point[]][]).map(([edgeId, points]) => {
        const d = roundedPath(points);
        const on = activeEdges.includes(edgeId);
        const key = KEY_EDGES.has(edgeId);
        return (
          <g key={edgeId} data-edge={edgeId} data-active={on || undefined}>
            <path
              d={d}
              strokeWidth={1.5}
              markerEnd={`url(#${arrowOff})`}
              className={cx('fill-none stroke-neutral', key && '[stroke-dasharray:4_5]')}
            />
            {key ? (
              on && (
                <path
                  d={d}
                  strokeWidth={2.5}
                  markerEnd={`url(#${arrowOn})`}
                  className="fill-none stroke-primary [stroke-dasharray:5_5]"
                />
              )
            ) : (
              <>
                {/* drawn on: a dash as long as the path, shifted out of sight while the edge is off */}
                <path
                  d={d}
                  pathLength={1}
                  strokeWidth={2.5}
                  className={cx(
                    'fill-none stroke-primary transition-[stroke-dashoffset] duration-700 ease-draw [stroke-dasharray:1] motion-reduce:transition-none',
                    on ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:1]',
                  )}
                />
                {/* the arrowhead on an invisible copy: it fades in once the line has nearly arrived, and goes at once */}
                <path
                  d={d}
                  markerEnd={`url(#${arrowOn})`}
                  className={cx(
                    'fill-none stroke-transparent motion-reduce:transition-none',
                    on ? 'opacity-100 transition-opacity delay-300 duration-200' : 'opacity-0',
                  )}
                />
              </>
            )}
          </g>
        );
      })}
      {(Object.entries(layout.nodes) as [MapNodeId, Point][]).map(([nodeId, [x, y]]) => {
        const on = activeNodes.includes(nodeId);
        const Icon = icons[nodeId];
        const text = texts[nodeId];
        return (
          <g key={nodeId} data-node={nodeId} data-active={on || undefined}>
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={8}
              strokeWidth={on ? 2 : 1}
              className={cx(
                'transition-[fill,stroke] duration-300 ease-out motion-reduce:transition-none',
                on ? 'fill-primary-light stroke-primary' : 'fill-surface stroke-divider',
              )}
            />
            <foreignObject x={x} y={y} width={width} height={height}>
              <div
                className={cx(
                  'flex h-full items-center gap-2.5 overflow-hidden px-3',
                  on ? 'text-primary-ink' : 'text-foreground',
                )}
              >
                <Icon
                  aria-hidden
                  strokeWidth={2}
                  className={cx('size-5 shrink-0', on ? 'text-primary' : 'text-muted')}
                />
                <div className="grid min-w-0 gap-0.5">
                  <p className="font-bold text-sm leading-tight">{text.title}</p>
                  <p
                    className={cx(
                      'text-xs leading-tight',
                      text.mono && 'font-mono',
                      on ? 'text-primary-ink' : 'text-muted',
                    )}
                  >
                    {text.sub}
                  </p>
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
