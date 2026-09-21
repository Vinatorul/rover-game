import type { Identity, Room } from './game';

export type Mode = 'host' | 'player' | 'screen';
export type RoomResult = { token?: string; room: Room };
export type TapPacket = { action: 'tap'; taps: number; seq: number; round: number };
export type TapQueue = { key: string; pending: number; seq: number; packet: TapPacket | null };

export function viewLink(mode: Mode, code = '') {
  const query = new URLSearchParams({ view: mode });
  if (code) query.set('room', code);
  return `${window.location.origin}${window.location.pathname}?${query}`;
}

export function loadIdentity(mode: Mode, code: string): Identity | null {
  try {
    const value = JSON.parse(localStorage.getItem(`rover:${mode}:${code}`) || 'null');
    return value?.code === code && value?.role === mode && typeof value?.token === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function saveIdentity(mode: Mode, code: string, token: string) {
  const identity = { code, token, role: mode };
  localStorage.setItem(`rover:${mode}:${code}`, JSON.stringify(identity));
}

export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(path: string, token = '', body?: unknown): Promise<T> {
  const response = await fetch(`/api/rooms${path}`, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(7000),
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.error || 'Комната пока недоступна. Попробуй ещё раз.', response.status);
  return data;
}

export function syncTapQueue(queue: TapQueue, room: Room, token: string) {
  const key = `${room.code}:${token}:${room.round}`;
  if (queue.key !== key) Object.assign(queue, { key, pending: 0, seq: room.player?.seq || 0, packet: null });
  queue.seq = Math.max(queue.seq, room.player?.seq || 0);
  return queue;
}

export function nextTapPacket(queue: TapQueue, round: number) {
  if (!queue.packet && queue.pending) {
    const taps = Math.min(queue.pending, 8);
    queue.pending -= taps;
    queue.packet = { action: 'tap', taps, seq: ++queue.seq, round };
  }
  return queue.packet;
}
