import { randomInt, randomUUID } from 'node:crypto';
import { database, transaction } from '../db/index.ts';
import { RACE_LIMIT, raceStatus } from './game.ts';
import type { Room } from './game.ts';

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
export type StoredPlayer = { token: string; name: string; team: number; taps: number; seq: number; last_tap: number };
type StoredTeam = { color: number; distance: number; size: number };

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
  transaction(() => {
    db.prepare('INSERT INTO rooms (code, host, created_at) VALUES (?, ?, ?)').run(code, token, Date.now());
    for (let color = 0; color < 4; color++)
      db.prepare('INSERT INTO teams (room, color) VALUES (?, ?)').run(code, color);
  });
  return { token, room: snapshot(code, '') };
}

export function finishRace(code: string, now: number) {
  database()
    .prepare(
      `UPDATE rooms SET status = 'finished', finished_at = ?, winner =
    (SELECT CASE WHEN COUNT(*) = 1 THEN MIN(color) END FROM teams WHERE room = ? AND size > 0 AND distance > 0
      AND distance = (SELECT MAX(distance) FROM teams WHERE room = ? AND size > 0))
    WHERE code = ? AND status = 'racing' AND started_at <= ? AND
    (started_at + ? <= ? OR EXISTS (SELECT 1 FROM teams WHERE room = ? AND distance >= rooms.target))`,
    )
    .run(now, code, code, code, now, RACE_LIMIT, now, code);
}

export function snapshot(code: string, token: string): Room {
  const now = Date.now();
  finishRace(code, now);
  const db = database(),
    room = getRoom(code);
  const teams = db
    .prepare('SELECT color, distance, size FROM teams WHERE room = ? ORDER BY color')
    .all(code) as StoredTeam[];
  const players = db
    .prepare('SELECT token, name, team, taps, seq FROM players WHERE room = ? ORDER BY joined_at, rowid')
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
    teams: teams.map((team) => ({
      ...team,
      size: players.filter((p) => p.team === team.color).length,
      members: players.filter((p) => p.team === team.color).map((p) => p.name),
    })),
    player: own ? { name: own.name, team: own.team, taps: own.taps, seq: own.seq } : undefined,
  };
}
