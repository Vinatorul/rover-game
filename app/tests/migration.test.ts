import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeDatabase, database } from '../db/index.ts';
import { snapshot } from '../lib/server.ts';

let directory = '';
const legacySchema = `
CREATE TABLE rooms (
  code TEXT PRIMARY KEY, host TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'lobby',
  target INTEGER NOT NULL DEFAULT 300, started_at INTEGER, finished_at INTEGER,
  winner INTEGER, round INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE teams (
  room TEXT NOT NULL REFERENCES rooms(code), color INTEGER NOT NULL,
  distance REAL NOT NULL DEFAULT 0, size INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room, color)
);
CREATE TABLE players (
  token TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(code), name TEXT NOT NULL,
  team INTEGER NOT NULL, taps INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL DEFAULT 0,
  last_tap REAL NOT NULL DEFAULT 0, joined_at INTEGER NOT NULL
);
INSERT INTO rooms VALUES ('RACE01', 'host-race', 'racing', 300, 1000, NULL, NULL, 7, 100);
INSERT INTO rooms VALUES ('DONE01', 'host-done', 'finished', 150, 1000, 2000, 2, 3, 100);
INSERT INTO rooms VALUES ('WAIT01', 'host-wait', 'lobby', 500, NULL, NULL, NULL, 1, 100);
INSERT INTO teams VALUES ('RACE01', 2, 42, 3);
INSERT INTO players VALUES ('late', 'RACE01', 'Позже', 2, 8, 2, 1500, 200);
INSERT INTO players VALUES ('first', 'RACE01', 'Первый', 2, 9, 3, 1600, 100);
INSERT INTO players VALUES ('second', 'RACE01', 'Второй', 2, 10, 4, 1700, 100);
INSERT INTO players VALUES ('done', 'DONE01', 'Финишер', 2, 150, 20, 2000, 100);
INSERT INTO players VALUES ('waiting', 'WAIT01', 'Ждущий', 0, 0, 0, 0, 100);
`;
const expectedNumbers = [
  ['done', 1],
  ['first', 1],
  ['second', 2],
  ['late', 3],
  ['waiting', 1],
];

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'rover-migration-test-'));
  process.env.DB_PATH = join(directory, 'legacy.sqlite');
  const legacy = new DatabaseSync(process.env.DB_PATH);
  legacy.exec(legacySchema);
  legacy.close();
});

afterEach(() => {
  closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

test('legacy team rooms become lobbies while tokens and stable per-room numbers survive', () => {
  const db = database();
  const numbers = db.prepare('SELECT token, number FROM players ORDER BY room, number').all();
  assert.deepEqual(
    numbers.map((row) => [row.token, row.number]),
    expectedNumbers,
  );
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY code').all();
  assert.deepEqual(
    rooms.map((row) => [row.code, row.host, row.round, row.target]),
    [
      ['DONE01', 'host-done', 4, 150],
      ['RACE01', 'host-race', 8, 300],
      ['WAIT01', 'host-wait', 2, 500],
    ],
  );
  for (const row of rooms) {
    assert.equal(row.status, 'lobby');
    assert.equal(row.started_at, null);
    assert.equal(row.finished_at, null);
    assert.equal(row.winner, null);
  }
  const scores = db.prepare('SELECT taps, seq, last_tap FROM players').all();
  assert.ok(scores.every((row) => row.taps === 0 && row.seq === 0 && row.last_tap === 0));
});

test('reopening a migrated database preserves the next race and assigned numbers', () => {
  const db = database();
  db.exec("UPDATE rooms SET status = 'racing', started_at = 3000 WHERE code = 'RACE01'");
  db.exec("UPDATE players SET taps = 9, seq = 3, last_tap = 4000 WHERE token = 'first'");
  closeDatabase();
  const restored = database();
  const room = restored.prepare("SELECT status, started_at, round FROM rooms WHERE code = 'RACE01'").get();
  assert.deepEqual({ ...room }, { status: 'racing', started_at: 3000, round: 8 });
  const player = restored.prepare("SELECT number, taps, seq, last_tap FROM players WHERE token = 'first'").get();
  assert.deepEqual({ ...player }, { number: 1, taps: 9, seq: 3, last_tap: 4000 });
});

test('migrated identities keep their colors and routes without changing saved data', () => {
  const first = snapshot('RACE01', 'first');
  assert.deepEqual(first.player, { number: 1, color: 3, route: 3, distance: 0, taps: 0, seq: 0 });
  closeDatabase();
  assert.deepEqual(snapshot('RACE01', 'first').racers, first.racers);
  assert.deepEqual(
    database()
      .prepare('SELECT token, number FROM players ORDER BY room, number')
      .all()
      .map((row) => [row.token, row.number]),
    expectedNumbers,
  );
});
