export const TRACK_START = 16;
export const TRACK_END = 90;
export const TRACK_GOAL = { x: TRACK_END, y: 50 } as const;
const SAMPLES = 640;
export type Point = { x: number; y: number; distance: number };
export type Track = { points: Point[]; length: number; path: string };
type Coordinate = readonly [number, number];
type Curve = readonly [Coordinate, Coordinate, Coordinate];

// Every route contains the same curves, only reordered and reflected vertically.
// Their physical lengths therefore remain equal at every viewport aspect ratio.
// Horizontal tangents at each join keep the separate park paths smooth.
const SEGMENTS = {
  bend: [
    [
      [4, 0],
      [14, 9],
      [18, 9],
    ],
  ],
  hairpin: [
    [
      [27, 0],
      [-7, 19],
      [20, 19],
    ],
  ],
  meadow: [
    [
      [9, 0],
      [1, 15],
      [11, 15],
    ],
    [
      [21, 15],
      [13, 0],
      [22, 0],
    ],
  ],
  grove: [
    [
      [3, 0],
      [3, 7],
      [7, 7],
    ],
    [
      [11, 7],
      [11, 0],
      [14, 0],
    ],
  ],
} as const satisfies Record<string, readonly Curve[]>;
const ROUTES = [
  {
    start: 22,
    segments: [
      ['grove', 1],
      ['bend', 1],
      ['meadow', -1],
      ['hairpin', 1],
    ],
  },
  {
    start: 40,
    segments: [
      ['bend', -1],
      ['hairpin', 1],
      ['grove', -1],
      ['meadow', 1],
    ],
  },
  {
    start: 60,
    segments: [
      ['hairpin', -1],
      ['meadow', -1],
      ['bend', 1],
      ['grove', 1],
    ],
  },
  {
    start: 78,
    segments: [
      ['bend', -1],
      ['grove', -1],
      ['hairpin', -1],
      ['meadow', -1],
    ],
  },
] as const;

function cubicPoint(start: Coordinate, [a, b, end]: Curve, t: number) {
  const u = 1 - t;
  const weights = [u ** 3, 3 * u ** 2 * t, 3 * u * t ** 2, t ** 3];
  const points = [start, a, b, end];
  return {
    x: points.reduce((sum, point, index) => sum + point[0] * weights[index], 0),
    y: points.reduce((sum, point, index) => sum + point[1] * weights[index], 0),
  };
}

function segmentPoint(curves: readonly Curve[], t: number) {
  const index = Math.min(curves.length - 1, Math.floor(t * curves.length));
  const start: Coordinate = index ? curves[index - 1][2] : [0, 0];
  return cubicPoint(start, curves[index], t * curves.length - index);
}

export function trackPoint(team: number, t: number) {
  const route = ROUTES[team];
  const progress = Math.max(0, Math.min(1, t)) * route.segments.length;
  const index = Math.min(route.segments.length - 1, Math.floor(progress));
  let x = TRACK_START,
    y: number = route.start;
  for (const [name, direction] of route.segments.slice(0, index)) {
    const end = SEGMENTS[name].at(-1)![2];
    x += end[0];
    y += end[1] * direction;
  }
  const [name, direction] = route.segments[index];
  const point = segmentPoint(SEGMENTS[name], progress - index);
  return { x: x + point.x, y: y + point.y * direction };
}

export function createTrack(team: number, aspect = 2): Track {
  const points: Point[] = [];
  let length = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const point = trackPoint(team, i / SAMPLES),
      previous = points.at(-1);
    if (previous) length += Math.hypot((point.x - previous.x) * aspect, point.y - previous.y);
    points.push({ ...point, distance: length });
  }
  const path = points.map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(4)},${point.y.toFixed(4)}`).join(' ');
  return { points, length, path };
}

export function positionOnTrack(track: Track, progress: number) {
  const target = Math.max(0, Math.min(1, progress)) * track.length;
  const index = track.points.findIndex((point) => point.distance >= target);
  if (index <= 0) return track.points[0];
  const before = track.points[index - 1],
    after = track.points[index];
  const fraction = (target - before.distance) / (after.distance - before.distance);
  return { x: before.x + (after.x - before.x) * fraction, y: before.y + (after.y - before.y) * fraction };
}
