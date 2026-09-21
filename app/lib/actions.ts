import { randomUUID } from 'node:crypto';
import { database, transaction } from '../db/index.ts';
import { RACE_LIMIT } from './game.ts';
import { GameError, getRoom, snapshot, finishRace } from './server.ts';
import type { StoredPlayer, StoredRoom } from './server.ts';

export type Body = { action?: string; name?: string; target?: number; taps?: number; seq?: number; round?: number };

export function joinRoom(code: string, token: string, body: Body) {
  const name = (typeof body.name === 'string' ? body.name.trim().slice(0, 24) : '') || 'Игрок';
  const db = database();
  const existing = db.prepare('SELECT token FROM players WHERE token = ? AND room = ?').get(token, code);
  if (existing) return { token, room: snapshot(code, token) };
  const identity = randomUUID();
  transaction(() => {
    if (getRoom(code).status !== 'lobby') throw new GameError('Заезд уже начался. Дождись следующего старта.', 409);
    db.prepare(
      `INSERT INTO players (token, room, name, team, joined_at)
      SELECT ?, ?, ?, t.color, ? FROM teams t WHERE t.room = ?
      ORDER BY (SELECT COUNT(*) FROM players p WHERE p.room = t.room AND p.team = t.color), RANDOM() LIMIT 1`,
    ).run(identity, code, name, Date.now(), code);
  });
  return { token: identity, room: snapshot(code, identity) };
}

function startRace(code: string) {
  const db = database();
  if (getRoom(code).status !== 'lobby') throw new GameError('Заезд уже начался.', 409);
  const count = db.prepare('SELECT COUNT(*) AS n FROM players WHERE room = ?').get(code) as { n: number };
  if (!count.n) throw new GameError('Дождись хотя бы одного игрока.');
  db.prepare(
    'UPDATE teams SET size = (SELECT COUNT(*) FROM players WHERE room = ? AND team = teams.color) WHERE room = ?',
  ).run(code, code);
  db.prepare("UPDATE rooms SET status = 'racing', started_at = ? WHERE code = ?").run(Date.now() + 4000, code);
}

function resetRace(code: string) {
  const db = database();
  db.prepare(
    "UPDATE rooms SET status = 'lobby', started_at = NULL, finished_at = NULL, winner = NULL, round = round + 1 WHERE code = ?",
  ).run(code);
  db.prepare('UPDATE teams SET distance = 0, size = 0 WHERE room = ?').run(code);
  db.prepare('UPDATE players SET taps = 0, seq = 0, last_tap = 0 WHERE room = ?').run(code);
}

function changeTarget(code: string, target: number | undefined) {
  if (![150, 300, 500].includes(target ?? 0)) throw new GameError('Выбери дистанцию.');
  if (getRoom(code).status !== 'lobby') throw new GameError('Дистанцию можно менять перед стартом.', 409);
  database().prepare('UPDATE rooms SET target = ? WHERE code = ?').run(target!, code);
}

export function hostAction(code: string, token: string, body: Body) {
  transaction(() => {
    if (getRoom(code).host !== token) throw new GameError('Управлять игрой может только ведущий.', 403);
    if (body.action === 'start') startRace(code);
    else if (body.action === 'reset') resetRace(code);
    else if (body.action === 'settings') changeTarget(code, body.target);
    else throw new GameError('Неизвестное действие.');
  });
  return { room: snapshot(code, '') };
}

function validateTap(body: Body) {
  if (!Number.isSafeInteger(body.taps) || !Number.isSafeInteger(body.seq) || !Number.isSafeInteger(body.round)) {
    throw new GameError('Некорректное нажатие.');
  }
  if (body.taps! < 1 || body.taps! > 8 || body.seq! < 1 || body.round! < 1)
    throw new GameError('Некорректное нажатие.');
}

function applyTap(code: string, player: StoredPlayer, room: StoredRoom, body: Body, now: number) {
  // Keep the 12 taps/second budget in integer units to avoid timestamp rounding.
  const base = Math.max(player.last_tap, room.started_at! * 12, (now - 1000) * 12);
  const credit = Math.min(body.taps!, Math.floor((now * 12 - base) / 1000));
  const db = database();
  db.prepare('UPDATE teams SET distance = distance + 1.0 * ? / MAX(size, 1) WHERE room = ? AND color = ?').run(
    credit,
    code,
    player.team,
  );
  db.prepare('UPDATE players SET taps = taps + ?, last_tap = ?, seq = ? WHERE token = ?').run(
    credit,
    base + credit * 1000,
    body.seq!,
    player.token,
  );
}

export function tapRoom(code: string, token: string, body: Body) {
  validateTap(body);
  const accepted = transaction(() => {
    const now = Date.now(),
      room = getRoom(code);
    const player = database()
      .prepare('SELECT * FROM players WHERE token = ? AND room = ?')
      .get(token, code) as StoredPlayer;
    if (!player) throw new GameError('Сначала присоединись к комнате.', 403);
    if (room.status !== 'racing' || now < room.started_at! || now >= room.started_at! + RACE_LIMIT) return false;
    if (body.round !== room.round || body.seq! <= player.seq) return false;
    applyTap(code, player, room, body, now);
    finishRace(code, now);
    return true;
  });
  finishRace(code, Date.now());
  return { accepted, seq: body.seq };
}

export function act(code: string, token: string, body: Body) {
  getRoom(code);
  if (body.action === 'join') return joinRoom(code, token, body);
  if (body.action === 'tap') return tapRoom(code, token, body);
  return hostAction(code, token, body);
}
