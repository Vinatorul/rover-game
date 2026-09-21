import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTapPacket, syncTapQueue, type TapQueue } from '../lib/client.ts';
import type { Room } from '../lib/game.ts';

function room(round = 1, seq = 0): Room {
  return {
    code: 'ABC123',
    status: 'racing',
    round,
    target: 300,
    startedAt: 1,
    finishedAt: null,
    winner: null,
    teams: [],
    serverNow: 10,
    player: { name: 'Игрок', team: 0, taps: 0, seq },
  };
}

function queue(): TapQueue {
  return { key: '', pending: 0, seq: 0, packet: null };
}

test('retry keeps the original packet while later taps wait for their own sequence', () => {
  const state = syncTapQueue(queue(), room(), 'player-token');
  state.pending = 3;
  const first = nextTapPacket(state, 1);
  state.pending += 2;
  assert.strictEqual(nextTapPacket(state, 1), first);
  assert.deepEqual(first, { action: 'tap', taps: 3, seq: 1, round: 1 });
  state.packet = null;
  assert.deepEqual(nextTapPacket(state, 1), { action: 'tap', taps: 2, seq: 2, round: 1 });
});

test('reload resumes the server sequence and delayed snapshots cannot lower it', () => {
  const state = syncTapQueue(queue(), room(1, 17), 'player-token');
  state.pending = 1;
  assert.equal(nextTapPacket(state, 1)?.seq, 18);
  syncTapQueue(state, room(1, 16), 'player-token');
  state.packet = null;
  state.pending = 1;
  assert.equal(nextTapPacket(state, 1)?.seq, 19);
});

test('a new round discards pending packets from the previous race', () => {
  const state = syncTapQueue(queue(), room(1, 17), 'player-token');
  state.pending = 10;
  nextTapPacket(state, 1);
  syncTapQueue(state, room(2), 'player-token');
  assert.equal(state.pending, 0);
  assert.equal(state.packet, null);
  state.pending = 1;
  assert.deepEqual(nextTapPacket(state, 2), { action: 'tap', taps: 1, seq: 1, round: 2 });
});

test('a different player cannot inherit queued taps from the previous identity', () => {
  const state = syncTapQueue(queue(), room(), 'first-token');
  state.pending = 4;
  nextTapPacket(state, 1);
  syncTapQueue(state, room(1, 3), 'second-token');
  assert.equal(state.pending, 0);
  assert.equal(state.packet, null);
  state.pending = 1;
  assert.equal(nextTapPacket(state, 1)?.seq, 4);
});
