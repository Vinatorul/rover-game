import { closeDatabase, database } from '../db/index.ts';
import { makeServer } from './http.ts';

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
database();
const server = makeServer();
server.listen(port, host, () => console.log(`Rover race is listening on http://${host}:${port}`));

function shutdown() {
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => {
    server.closeAllConnections();
    closeDatabase();
    process.exit(0);
  }, 5000).unref();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
