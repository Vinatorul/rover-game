import { randomInt, randomUUID } from 'node:crypto';
import { database } from '../db/index.ts';
import { RACE_LIMIT, raceStatus } from './game.ts';
import type { Racer, Room } from './game.ts';

export type StoredRoom = {
  code: string;
  host: string;
  status: string;
  target: number;
  started_at: number | null;
  finished_at: number | null;
  winner: number | null;
  round: number;
};
export type StoredPlayer = { token: string; number: number; taps: number; seq: number; last_tap: number };

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function getRoom(code: string) {
  const room = database().prepare('SELECT * FROM rooms WHERE code = ?').get(code) as StoredRoom | undefined;
  if (!room) throw new GameError('Комната не найдена. Проверь код.', 404);
  return room;
}

export function createRoom() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const db = database(),
    token = randomUUID();
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
  } while (db.prepare('SELECT code FROM rooms WHERE code = ?').get(code));
  db.prepare('INSERT INTO rooms (code, host, created_at) VALUES (?, ?, ?)').run(code, token, Date.now());
  return { token, room: snapshot(code, '') };
}

export function finishRace(code: string, now: number) {
  database()
    .prepare(
      `UPDATE rooms SET status = 'finished', finished_at = ?, winner =
    (SELECT CASE WHEN COUNT(*) = 1 THEN MIN(number) END FROM players WHERE room = ? AND taps > 0
      AND taps = (SELECT MAX(taps) FROM players WHERE room = ?))
    WHERE code = ? AND status = 'racing' AND started_at <= ? AND
    (started_at + ? <= ? OR EXISTS (SELECT 1 FROM players WHERE room = ? AND taps >= rooms.target))`,
    )
    .run(now, code, code, code, now, RACE_LIMIT, now, code);
}

export function snapshot(code: string, token: string): Room {
  const now = Date.now();
  finishRace(code, now);
  const db = database(),
    room = getRoom(code);
  const players = db
    .prepare('SELECT token, number, taps, seq FROM players WHERE room = ? ORDER BY number')
    .all(code) as StoredPlayer[];
  const own = players.find((player) => player.token === token);
  return {
    code,
    status: raceStatus(room, now) as Room['status'],
    target: room.target,
    startedAt: room.started_at,
    finishedAt: room.finished_at,
    winner: room.winner,
    round: room.round,
    serverNow: now,
    racers: players.map(racer),
    player: own ? { ...racer(own), taps: own.taps, seq: own.seq } : undefined,
  };
}

function racer(player: StoredPlayer): Racer {
  return { number: player.number, color: (player.number - 1) % 4, distance: player.taps };
}
