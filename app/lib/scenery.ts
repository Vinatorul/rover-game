export type Plant = {
  id: string;
  kind: 'birch' | 'linden' | 'lilac' | 'flowers';
  x: number;
  y: number;
  width: number;
  maxWidth: number;
};

export const PLANTS: Plant[] = [
  { id: 'upper-flowers-left', kind: 'flowers', x: 31, y: 13, width: 8, maxWidth: 110 },
  { id: 'upper-flowers-middle', kind: 'flowers', x: 63, y: 17, width: 10, maxWidth: 135 },
  { id: 'upper-lilac', kind: 'lilac', x: 85, y: 13, width: 10, maxWidth: 140 },
  { id: 'upper-birch', kind: 'birch', x: 39, y: 23, width: 9, maxWidth: 125 },
  { id: 'grove-lilac', kind: 'lilac', x: 25, y: 48, width: 8, maxWidth: 110 },
  { id: 'crossing-linden', kind: 'linden', x: 44, y: 61, width: 12, maxWidth: 165 },
  { id: 'middle-lilac', kind: 'lilac', x: 70, y: 78, width: 8, maxWidth: 115 },
  { id: 'middle-linden', kind: 'linden', x: 70, y: 39, width: 14, maxWidth: 190 },
  { id: 'left-birch', kind: 'birch', x: 7, y: 62, width: 17, maxWidth: 225 },
  { id: 'lower-flowers-middle', kind: 'flowers', x: 57, y: 91, width: 11, maxWidth: 155 },
  { id: 'lower-flowers-right', kind: 'flowers', x: 80, y: 94, width: 8, maxWidth: 100 },
  { id: 'lower-lilac', kind: 'lilac', x: 27, y: 92, width: 10, maxWidth: 145 },
  { id: 'meadow-flowers', kind: 'flowers', x: 57, y: 76, width: 9, maxWidth: 120 },
  { id: 'finish-lilac', kind: 'lilac', x: 94, y: 36, width: 8, maxWidth: 110 },
  { id: 'right-birch', kind: 'birch', x: 96, y: 87, width: 18, maxWidth: 240 },
];

export function sceneDepth(groundY: number) {
  return Math.round(groundY) + 10;
}

// Scenery is mounted before the rovers. Equal depths therefore put the rover
// in front consistently, while every change in rounded ground Y wins over order.
export function plantsByDepth(plants: readonly Plant[] = PLANTS) {
  return [...plants].sort((left, right) => sceneDepth(left.y) - sceneDepth(right.y) || left.id.localeCompare(right.id));
}
