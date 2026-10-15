export const ROVER_COLORS = [
  { name: 'Красные', color: '#ff665b', key: 'red', sprite: 0, hue: 0 },
  { name: 'Зелёные', color: '#b5e85b', key: 'green', sprite: 1, hue: 0 },
  { name: 'Синие', color: '#64abff', key: 'blue', sprite: 2, hue: 0 },
  { name: 'Жёлтые', color: '#ffd460', key: 'yellow', sprite: 3, hue: 0 },
  { name: 'Оранжевые', color: '#e2742c', key: 'orange', sprite: 0, hue: 25 },
  { name: 'Бирюзовые', color: '#03ac90', key: 'turquoise', sprite: 0, hue: 165 },
  { name: 'Фиолетовые', color: '#a36bff', key: 'violet', sprite: 0, hue: 265 },
  { name: 'Розовые', color: '#e760d9', key: 'pink', sprite: 0, hue: 300 },
  { name: 'Голубые', color: '#1ba0c6', key: 'sky', sprite: 0, hue: 190 },
  { name: 'Салатовые', color: '#719907', key: 'lime', sprite: 0, hue: 80 },
  { name: 'Лавандовые', color: '#797dff', key: 'lavender', sprite: 0, hue: 245 },
  { name: 'Малиновые', color: '#ff5e92', key: 'raspberry', sprite: 0, hue: 335 },
] as const;
export const ROUTE_COUNT = 4;
export type Racer = { number: number; color: number; route: number; distance: number };
export type Player = Racer & { taps: number; seq: number };
export type Room = {
  code: string;
  status: 'lobby' | 'countdown' | 'racing' | 'finished';
  target: number;
  startedAt: number | null;
  finishedAt: number | null;
  winner: number | null;
  round: number;
  racers: Racer[];
  player?: Player;
  serverNow: number;
};
export type Identity = { token: string; role: 'host' | 'player'; code: string };
export const RACE_LIMIT = 180000;
export function raceStatus(room: { status: string; started_at: number | null }, now: number) {
  if (room.status === 'racing' && room.started_at && now < room.started_at) return 'countdown';
  return room.status;
}
