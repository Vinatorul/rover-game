import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { act } from '../lib/actions.ts';
import type { Body } from '../lib/actions.ts';
import { createRoom, GameError, snapshot } from '../lib/server.ts';

const staticRoot = fileURLToPath(new URL('../dist', import.meta.url));
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function json(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function permitOrigin(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  if (!origin) return;
  if (!URL.canParse(origin)) throw new GameError('Этот адрес не разрешён для подключения.', 403);
  const allowed = process.env.ALLOWED_ORIGIN?.split(',').map((entry) => entry.trim()) || [];
  const sameHost = new URL(origin).host === request.headers.host;
  if (!sameHost && !allowed.includes(origin)) throw new GameError('Этот адрес не разрешён для подключения.', 403);
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

function readBody(request: IncomingMessage): Promise<Body> {
  return new Promise((resolveBody, reject) => {
    let body = '',
      tooLarge = false;
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > 4096) {
        tooLarge = true;
        reject(new GameError('Слишком большой запрос.', 413));
      }
    });
    request.on('end', () => {
      if (tooLarge) return;
      try {
        const parsed = JSON.parse(body || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        resolveBody(parsed);
      } catch {
        reject(new GameError('Некорректный запрос.'));
      }
    });
    request.on('error', reject);
  });
}

async function api(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  const token = request.headers.authorization?.replace(/^Bearer /, '') || '';
  if (pathname === '/api/health' || pathname === '/health') return json(response, { ok: true });
  if (pathname === '/api/rooms' && request.method === 'POST') return json(response, createRoom(), 201);
  const room = /^\/api\/rooms\/([a-zA-Z0-9]{6})$/.exec(pathname)?.[1].toUpperCase();
  if (!room) throw new GameError('Адрес не найден.', 404);
  if (request.method === 'GET') return json(response, snapshot(room, token));
  if (request.method === 'POST') return json(response, act(room, token, await readBody(request)));
  throw new GameError('Метод не поддерживается.', 405);
}

async function serveStatic(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (!['GET', 'HEAD'].includes(request.method || '')) throw new GameError('Метод не поддерживается.', 405);
  const file = resolve(staticRoot, `.${decodeURIComponent(pathname)}`);
  if (file !== staticRoot && !file.startsWith(`${staticRoot}${sep}`)) throw new GameError('Адрес не найден.', 404);
  const exists = await stat(file).then(
    (entry) => entry.isFile(),
    () => false,
  );
  if (!exists && extname(file)) throw new GameError('Файл не найден.', 404);
  const selected = exists ? file : resolve(staticRoot, 'index.html');
  const info = await stat(selected).catch(() => {
    throw new GameError('Сначала собери приложение: npm run build.', 503);
  });
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(selected)] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': selected.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (request.method === 'HEAD') return response.end();
  await pipeline(createReadStream(selected), response);
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    if (pathname.startsWith('/api/') || pathname === '/health') {
      permitOrigin(request, response);
      await api(request, response, pathname);
    } else await serveStatic(request, response, pathname);
  } catch (error) {
    if (response.headersSent || response.destroyed) return;
    if (!(error instanceof GameError)) console.error(error);
    json(
      response,
      { error: error instanceof GameError ? error.message : 'Не удалось выполнить запрос. Попробуй ещё раз.' },
      error instanceof GameError ? error.status : 500,
    );
  }
}

export function makeServer() {
  const server = createServer((request, response) => {
    void handle(request, response);
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return server;
}
