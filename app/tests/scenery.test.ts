import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANTS, plantsByDepth, sceneDepth } from '../lib/scenery.ts';
import { createTrack } from '../lib/track.ts';

test('the same tree covers a rover behind it and is covered when the rover moves in front', () => {
  const tree = PLANTS.find((plant) => plant.id === 'middle-linden')!;
  const route = createTrack(2).points;
  const behind = route.reduce((nearest, point) => (point.y < nearest.y ? point : nearest));
  const inFront = route.reduce((nearest, point) => (point.y > nearest.y ? point : nearest));
  assert.ok(sceneDepth(behind.y) < sceneDepth(tree.y));
  assert.ok(sceneDepth(inFront.y) > sceneDepth(tree.y));
});

test('plant painting order is stable for equal ground depths', () => {
  const middlePlants = PLANTS.filter((plant) => plant.id.startsWith('middle-')).map((plant) => ({ ...plant, y: 52 }));
  const normal = plantsByDepth(middlePlants).map((plant) => plant.id);
  const reversed = plantsByDepth([...middlePlants].reverse()).map((plant) => plant.id);
  assert.deepEqual(normal, ['middle-lilac', 'middle-linden']);
  assert.deepEqual(reversed, normal);
  assert.equal(sceneDepth(52), sceneDepth(52.2));
});

test('every scene object remains between the road and the game overlays', () => {
  for (const plant of PLANTS) {
    assert.ok(sceneDepth(plant.y) > 1);
    assert.ok(sceneDepth(plant.y) < 200);
  }
  assert.equal(sceneDepth(0), 10);
  assert.equal(sceneDepth(100), 110);
});
