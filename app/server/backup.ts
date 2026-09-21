import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node server/backup.ts <database.sqlite> <backup.sqlite>');
if (!existsSync(source)) throw new Error('Source database does not exist.');
if (resolve(source) === resolve(destination) || existsSync(destination))
  throw new Error('Backup destination already exists.');
mkdirSync(dirname(destination), { recursive: true });
const database = new DatabaseSync(source, { readOnly: true });
try {
  await backup(database, destination);
  console.log(`Database backed up to ${destination}`);
} finally {
  database.close();
}
