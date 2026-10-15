import assert from 'node:assert/strict';
import { after, before, test, mock } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';
import viteConfig from '../vite.config.ts';
import type { AddressInfo } from 'node:net';
import type { Room } from '../lib/game.ts';
import { closeDatabase } from '../db/index.ts';
import { makeServer } from '../server/http.ts';

const directory = mkdtempSync(join(tmpdir(), 'rover-game-test-'));
const server = makeServer();
let origin = '',
  now = 1_800_000_000_000;
type Reply = { token: string; room: Room; accepted: boolean; seq: number; error: string };

before(async () => {
  process.env.DB_PATH = join(directory, 'rooms.sqlite');
  mock.method(Date, 'now', () => now);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  closeDatabase();
  mock.restoreAll();
  rmSync(directory, { recursive: true, force: true });
});

async function request(path: string, body?: unknown, token = '') {
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: (await response.json()) as Reply };
}

async function fixture(count = 4) {
  const created = await request('/api/rooms', {});
  assert.equal(created.status, 201);
  const path = `/api/rooms/${created.data.room.code}`;
  const replies = await Promise.all(Array.from({ length: count }, () => request(path, { action: 'join' })));
  return { host: created.data.token, path, players: replies.map((reply) => reply.data) };
}

async function room(path: string, token = '') {
  return (await request(path, undefined, token)).data as unknown as Room;
}

async function start(game: Awaited<ReturnType<typeof fixture>>) {
  const response = await request(game.path, { action: 'start' }, game.host);
  assert.equal(response.status, 200);
  now += 5000;
  return (await room(game.path)).round;
}

function tap(path: string, token: string, seq: number, round: number, taps = 3) {
  return request(path, { action: 'tap', taps, seq, round }, token);
}

test('concurrent joins create unique numbered racers and reconnect does not duplicate', async () => {
  const game = await fixture(40);
  const state = await room(game.path);
  assert.equal(state.racers.length, 40);
  assert.deepEqual(
    state.racers.map((racer) => racer.number),
    Array.from({ length: 40 }, (_, index) => index + 1),
  );
  assert.ok(state.racers.every((racer) => racer.color >= 0 && racer.color <= 3 && racer.distance === 0));
  assert.equal(new Set(game.players.map((player) => player.token)).size, 40);
  assert.equal(new Set(game.players.map((player) => player.room.player?.number)).size, 40);
  const first = game.players[0];
  await request(game.path, { action: 'join' }, first.token);
  assert.equal((await room(game.path)).racers.length, 40);
  assert.equal((await room(game.path, first.token)).player?.number, first.room.player?.number);
  assert.equal('teams' in state, false);
  assert.equal('host' in state, false);
  assert.equal(JSON.stringify(state).includes(first.token), false);
});

test('host authorization and countdown prevent early taps or late joins', async () => {
  const game = await fixture(1),
    token = game.players[0].token;
  for (const action of ['start', 'reset', 'settings']) {
    assert.equal((await request(game.path, { action, target: 150 }, token)).status, 403);
  }
  assert.equal((await request(game.path, { action: 'settings', target: 123 }, game.host)).status, 400);
  assert.equal((await request(game.path, { action: 'settings', target: 150 }, game.host)).data.room.target, 150);
  const started = await request(game.path, { action: 'start' }, game.host);
  assert.equal(started.data.room.status, 'countdown');
  assert.equal(started.data.room.startedAt, now + 4000);
  assert.equal((await tap(game.path, token, 1, 1)).data.accepted, false);
  assert.equal((await request(game.path, { action: 'join', name: 'Поздно' })).status, 409);
  assert.equal((await request(game.path, { action: 'start' }, game.host)).status, 409);
  assert.equal((await request(game.path, { action: 'settings', target: 300 }, game.host)).status, 409);
  now += 4000;
  assert.equal((await room(game.path)).status, 'racing');
});

test('an empty room cannot start', async () => {
  const game = await fixture(0);
  assert.equal((await request(game.path, { action: 'start' }, game.host)).status, 400);
  assert.equal((await room(game.path)).status, 'lobby');
});

test('players join without a name and reconnect to the same racer after the start', async () => {
  const game = await fixture(0);
  const first = await request(game.path, { action: 'join' });
  assert.equal(first.status, 200);
  assert.ok(first.data.token);
  const second = await request(game.path, { action: 'join', name: '' });
  assert.equal(second.status, 200);
  assert.notEqual(first.data.room.player?.number, second.data.room.player?.number);
  await start(game);
  const rejoined = await request(game.path, { action: 'join' }, first.data.token);
  assert.equal(rejoined.status, 200);
  assert.equal(rejoined.data.token, first.data.token);
  assert.equal(rejoined.data.room.player?.number, first.data.room.player?.number);
  assert.equal(rejoined.data.room.player?.color, first.data.room.player?.color);
  assert.equal(rejoined.data.room.racers.length, 2);
});

test('each tap advances only its own racer, even when racers share a color', async () => {
  const game = await fixture(11),
    round = await start(game);
  assert.equal(game.players[2].room.player?.color, game.players[10].room.player?.color);
  await tap(game.path, game.players[2].token, 1, round, 1);
  await tap(game.path, game.players[10].token, 1, round, 8);
  const distances = new Map((await room(game.path)).racers.map((racer) => [racer.number, racer.distance]));
  for (const [index, player] of game.players.entries()) {
    assert.equal(distances.get(player.room.player!.number), index === 2 ? 1 : index === 10 ? 8 : 0);
  }
});

test('duplicate, reordered, and previous-round tap batches never score twice', async () => {
  const game = await fixture(1),
    token = game.players[0].token,
    round = await start(game);
  assert.equal((await tap(game.path, token, 2, round)).data.accepted, true);
  assert.equal((await tap(game.path, token, 2, round)).data.accepted, false);
  assert.equal((await tap(game.path, token, 1, round)).data.accepted, false);
  assert.equal((await room(game.path, token)).player?.taps, 3);
  await request(game.path, { action: 'reset' }, game.host);
  const reset = await room(game.path, token);
  assert.equal(reset.round, round + 1);
  assert.equal(reset.player?.seq, 0);
  assert.equal(reset.player?.taps, 0);
  assert.equal(reset.player?.number, game.players[0].room.player?.number);
  assert.equal(reset.player?.color, game.players[0].room.player?.color);
  assert.ok(reset.racers.every((racer) => racer.distance === 0));
  await start(game);
  assert.equal((await tap(game.path, token, 50, round)).data.accepted, false);
  assert.equal((await tap(game.path, token, 1, round + 1)).data.accepted, true);
  assert.equal((await room(game.path, token)).player?.taps, 3);
});

test('tap batches are bounded and each player is limited to twelve taps per second', async () => {
  const game = await fixture(2),
    token = game.players[0].token,
    round = await start(game);
  assert.equal((await tap(game.path, token, 1, round, 9)).status, 400);
  await tap(game.path, token, 1, round, 8);
  await tap(game.path, token, 2, round, 8);
  await tap(game.path, token, 3, round, 8);
  assert.equal((await room(game.path, token)).player?.taps, 12);
  await tap(game.path, game.players[1].token, 1, round, 8);
  assert.equal((await room(game.path, game.players[1].token)).player?.taps, 8);
  assert.equal((await tap(game.path, '', 1, round)).status, 403);
});

test('first racer reaching the distance wins and finished races stop scoring for everyone', async () => {
  const game = await fixture(7),
    token = game.players[6].token;
  await request(game.path, { action: 'settings', target: 150 }, game.host);
  const round = await start(game);
  for (let seq = 1; seq <= 19; seq++) {
    now += 1000;
    await tap(game.path, token, seq, round, 8);
  }
  const finished = await room(game.path, token);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.winner, 7);
  assert.equal(finished.winner, finished.player?.number);
  assert.equal(finished.player?.distance, 152);
  now += 1000;
  assert.equal((await tap(game.path, token, 20, round, 8)).data.accepted, false);
  assert.equal((await tap(game.path, game.players[1].token, 1, round, 8)).data.accepted, false);
  assert.equal((await room(game.path, token)).player?.taps, 152);
  assert.equal((await room(game.path, game.players[1].token)).player?.distance, 0);
});

test('time limit awards the farthest individual racer', async () => {
  const game = await fixture(2);
  const round = await start(game);
  await tap(game.path, game.players[0].token, 1, round);
  await tap(game.path, game.players[1].token, 1, round, 6);
  now += 180000;
  const finished = await room(game.path, game.players[1].token);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.winner, finished.player?.number);
});

test('reset keeps existing numbers and new joins receive the next number', async () => {
  const game = await fixture(5);
  await start(game);
  await request(game.path, { action: 'reset' }, game.host);
  const newcomer = await request(game.path, { action: 'join' });
  assert.equal(newcomer.data.room.player?.number, 6);
  for (const player of game.players) {
    const restored = await room(game.path, player.token);
    assert.equal(restored.player?.number, player.room.player?.number);
    assert.equal(restored.player?.color, player.room.player?.color);
  }
});

test('timeout produces no winner when nobody tapped or leading racers are tied', async () => {
  const empty = await fixture(1);
  await start(empty);
  now += 180000;
  assert.equal((await room(empty.path)).winner, null);
  const tied = await fixture(4),
    round = await start(tied);
  await Promise.all(tied.players.map((player) => tap(tied.path, player.token, 1, round)));
  now += 180000;
  const result = await room(tied.path);
  assert.equal(result.status, 'finished');
  assert.equal(result.winner, null);
});

test('SQLite preserves room, player identity, score, and host permissions when reopened', async () => {
  const game = await fixture(2),
    token = game.players[0].token,
    round = await start(game);
  await tap(game.path, token, 1, round);
  closeDatabase();
  const restored = await room(game.path, token);
  assert.equal(restored.player?.taps, 3);
  assert.equal(restored.player?.distance, 3);
  assert.equal(restored.player?.number, game.players[0].room.player?.number);
  assert.equal(restored.player?.color, game.players[0].room.player?.color);
  assert.equal(restored.racers.find((racer) => racer.number === game.players[1].room.player?.number)?.distance, 0);
  assert.equal(restored.status, 'racing');
  assert.equal((await request(game.path, { action: 'reset' }, game.host)).data.room.status, 'lobby');
});

test('HTTP reports malformed requests, unknown rooms, disallowed origins, and health', async () => {
  const game = await fixture(0);
  const malformed = await fetch(`${origin}${game.path}`, { method: 'POST', body: '{' });
  assert.equal(malformed.status, 400);
  assert.equal((await request('/api/rooms/AAAAAA')).status, 404);
  const forbidden = await fetch(`${origin}/api/rooms`, {
    method: 'POST',
    headers: { Origin: 'https://other.example' },
  });
  assert.equal(forbidden.status, 403);
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  assert.equal((await fetch(`${origin}/api/health`)).status, 200);
});

test('online SQLite backup includes active room data', async () => {
  const game = await fixture(1);
  const destination = join(directory, 'backup.sqlite');
  execFileSync(process.execPath, ['server/backup.ts', process.env.DB_PATH!, destination]);
  const copy = new DatabaseSync(destination, { readOnly: true });
  try {
    const saved = copy.prepare('SELECT host FROM rooms WHERE code = ?').get(game.path.split('/').at(-1)!);
    assert.equal(saved?.host, game.host);
  } finally {
    copy.close();
  }
});

async function viteProxy() {
  const proxy = viteConfig.server?.proxy?.['/api'];
  if (!proxy || typeof proxy === 'string') throw new Error('Expected explicit Vite proxy options.');
  return createViteServer({
    ...viteConfig,
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: {
      host: '127.0.0.1',
      port: 0,
      hmr: false,
      watch: null,
      proxy: { '/api': { ...proxy, target: origin } },
    },
  });
}

test('Vite preserves browser origin and rejects foreign origins through the proxy', async () => {
  const vite = await viteProxy();
  try {
    await vite.listen();
    const address = vite.httpServer!.address() as AddressInfo;
    const frontend = `http://127.0.0.1:${address.port}`;
    const joined = await fetch(`${frontend}/api/rooms`, { method: 'POST', headers: { Origin: frontend } });
    assert.equal(joined.status, 201);
    const denied = await fetch(`${frontend}/api/rooms`, {
      method: 'POST',
      headers: { Origin: 'https://other.example' },
    });
    assert.equal(denied.status, 403);
  } finally {
    await vite.close();
  }
});
