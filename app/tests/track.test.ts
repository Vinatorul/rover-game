import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTrack, positionOnTrack, trackPoint, TRACK_START, TRACK_GOAL, type Point } from '../lib/track.ts';

test('all four winding courses have equal physical length at phone, host, and TV aspect ratios', () => {
  for (const aspect of [0.75, 1, 1.5, 2, 3, 4]) {
    const lengths = [0, 1, 2, 3].map((team) => createTrack(team, aspect).length);
    assert.ok(Math.max(...lengths) - Math.min(...lengths) < 0.000001);
  }
});

test('distinct park routes stay within the field and include broad turns and hairpins', () => {
  const starts = [0, 1, 2, 3].map((team) => trackPoint(team, 0));
  assert.equal(new Set(starts.map((point) => point.y.toFixed(2))).size, 4);
  for (const team of [0, 1, 2, 3]) {
    const track = createTrack(team);
    assert.equal(positionOnTrack(track, 0).x, TRACK_START);
    assert.deepEqual(positionOnTrack(track, 1), TRACK_GOAL);
    assert.ok(track.points.every((point) => point.x >= 16 && point.x <= 90 && point.y >= 15 && point.y <= 86));
    assert.ok(track.points.some((point, index) => index > 0 && point.x < track.points[index - 1].x));
  }
  assert.equal(new Set([0, 1, 2, 3].map((team) => createTrack(team).path)).size, 4);
});

function side(a: Point, b: Point, p: Point) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function crosses(a: Point, b: Point, c: Point, d: Point) {
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

test('every route crosses another park path before reaching the shared goal', () => {
  const paths = [0, 1, 2, 3].map((team) => createTrack(team).points.filter((_, i) => i % 8 === 0));
  for (const [team, path] of paths.entries()) {
    assert.ok(
      paths.some(
        (other, opponent) =>
          opponent !== team &&
          path.some(
            (a, i) => i > 0 && a.x < 86 && other.some((c, j) => j > 0 && crosses(path[i - 1], a, other[j - 1], c)),
          ),
      ),
    );
  }
});

test('routes meet smoothly at joins without a repeated four-lane wave', () => {
  for (const team of [0, 1, 2, 3]) {
    for (const t of [0.25, 0.5, 0.75]) {
      const before = trackPoint(team, t - 1e-5),
        join = trackPoint(team, t),
        after = trackPoint(team, t + 1e-5);
      assert.ok(before.x < join.x && after.x > join.x);
      assert.ok(Math.abs(before.y - join.y) < 1e-5 && Math.abs(after.y - join.y) < 1e-5);
    }
  }
});

test('each rover advances by arc distance rather than horizontal position', () => {
  for (const aspect of [0.75, 2, 4]) {
    const tracks = [0, 1, 2, 3].map((team) => createTrack(team, aspect));
    const lengths = tracks.map((track) => {
      let total = 0,
        previous = positionOnTrack(track, 0);
      for (let step = 1; step <= 3000; step++) {
        const point = positionOnTrack(track, step / 6000);
        total += Math.hypot((point.x - previous.x) * aspect, point.y - previous.y);
        previous = point;
      }
      assert.ok(Math.abs(total / track.length - 0.5) < 0.00001);
      return total;
    });
    // Straight chords slightly shorten different curves between sampled positions.
    assert.ok(Math.max(...lengths) - Math.min(...lengths) < tracks[0].length * 0.00001);
  }
});
