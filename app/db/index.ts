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
  return connection;
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
