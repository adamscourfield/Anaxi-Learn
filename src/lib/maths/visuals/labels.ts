import type { VisualPoint } from './types';

export function labelOffset(point: VisualPoint, dx = 0, dy = 0): VisualPoint {
  return {
    x: point.x + dx,
    y: point.y + dy,
  };
}
