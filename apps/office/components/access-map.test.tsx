import { describe, expect, it } from 'vitest';
import { access } from '../content/access.tsx';
import { type MapEdgeId, mapLayout, roundedPath } from './access-map.tsx';

const { node, nodes, edges } = mapLayout;

/** whether the point lies on the border of a node's box */
const onBorder = ([px, py]: readonly [number, number]) =>
  Object.values(nodes).some(([x, y]) => {
    const insideX = px >= x && px <= x + node.width;
    const insideY = py >= y && py <= y + node.height;
    return (insideX && (py === y || py === y + node.height)) || (insideY && (px === x || px === x + node.width));
  });

describe('the access diagram', () => {
  it('has every edge the tour lights', () => {
    for (const step of access.tour.steps) for (const edge of step.edges) expect(edges).toHaveProperty(edge);
  });

  it('starts and ends every edge on a box, with straight segments only', () => {
    for (const [id, points] of Object.entries(edges) as [MapEdgeId, (typeof edges)[MapEdgeId]][]) {
      const first = points?.[0];
      const last = points?.at(-1);
      expect(first && onBorder(first), `${id} starts on a box`).toBe(true);
      expect(last && onBorder(last), `${id} ends on a box`).toBe(true);
      for (let i = 1; i < (points?.length ?? 0); i++) {
        const [ax, ay] = points?.[i - 1] ?? [0, 0];
        const [bx, by] = points?.[i] ?? [0, 0];
        expect(ax === bx || ay === by, `${id} segment ${i} is horizontal or vertical`).toBe(true);
      }
    }
  });

  it('keeps every box inside the drawing', () => {
    for (const [x, y] of Object.values(nodes)) {
      expect(x + node.width).toBeLessThanOrEqual(mapLayout.width);
      expect(y + node.height).toBeLessThanOrEqual(mapLayout.height);
    }
  });

  it('rounds the corners of a path', () => {
    expect(
      roundedPath([
        [0, 0],
        [20, 0],
        [20, 20],
      ]),
    ).toBe('M0,0 L12,0 Q20,0 20,8 L20,20');
    expect(roundedPath([])).toBe('');
  });
});
