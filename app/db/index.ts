import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let connection: DatabaseSync | undefined;

export function database() {
  if (connection) return connection;
  const path = process.env.DB_PATH || resolve('data/rover.sqlite');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  connection = new DatabaseSync(path);
  connection.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  migrateIndividualRaces(connection);
  return connection;
}

function migrateIndividualRaces(db: DatabaseSync) {
  const columns = db.prepare('PRAGMA table_info(players)').all();
  if (columns.some((column) => column.name === 'number')) return;
  db.exec(`BEGIN IMMEDIATE;
    ALTER TABLE players ADD COLUMN number INTEGER NOT NULL DEFAULT 0;
    WITH numbered AS (
      SELECT token, ROW_NUMBER() OVER (PARTITION BY room ORDER BY joined_at, rowid) AS value FROM players
    ) UPDATE players SET number = (SELECT value FROM numbered WHERE numbered.token = players.token),
      taps = 0, seq = 0, last_tap = 0;
    UPDATE rooms SET status = 'lobby', started_at = NULL, finished_at = NULL,
      winner = NULL, round = round + 1;
    COMMIT;`);
}

export function transaction<T>(operation: () => T): T {
  const db = database();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function closeDatabase() {
  connection?.close();
  connection = undefined;
}
