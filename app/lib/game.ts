export const TEAM_COLORS = [
  { name: 'Красные', color: '#ff665b', key: 'red' },
  { name: 'Зелёные', color: '#b5e85b', key: 'green' },
  { name: 'Синие', color: '#64abff', key: 'blue' },
  { name: 'Жёлтые', color: '#ffd460', key: 'yellow' },
] as const;
export type Team = { color: number; distance: number; size: number; members: string[] };
export type Player = { name: string; team: number; taps: number; seq: number };
export type Room = { code: string; status: 'lobby' | 'countdown' | 'racing' | 'finished'; target: number; startedAt: number | null; finishedAt: number | null; winner: number | null; round: number; teams: Team[]; player?: Player; serverNow: number };
export type Identity = { token: string; role: 'host' | 'player'; code: string };
export const RACE_LIMIT = 180000;
export function raceStatus(room: { status: string; started_at: number | null }, now: number) {
  if (room.status === 'racing' && room.started_at && now < room.started_at) return 'countdown';
  return room.status;
}
