import type { CSSProperties } from 'react';
import { Trophy, Users } from 'lucide-react';
import { TEAM_COLORS, type Room } from '@/lib/game';
import { useClock } from './use-game';
import { TrackCourse } from './track-course';

type RoomProps = { room: Room | null };

export function Rover({ team, className = '' }: { team: number; className?: string }) {
  return (
    <div
      className={`rover-sprite ${className}`}
      role="img"
      aria-label={`Ровер команды «${TEAM_COLORS[team].name}»`}
      style={{
        backgroundPosition: `${team % 2 ? 100 : 0}% ${team > 1 ? 100 : 0}%`,
        clipPath: team > 1 ? 'inset(2.2% 0 0)' : undefined,
      }}
    />
  );
}

export function RaceTrack({ room, offset = 0 }: RoomProps & { offset?: number }) {
  const now = useClock() + offset;
  return (
    <section className="race-panel" aria-label="Гоночная трасса">
      <TrackCourse room={room}>
        <RaceOverlay room={room} now={now} />
      </TrackCourse>
    </section>
  );
}

function RaceOverlay({ room, now }: RoomProps & { now: number }) {
  if (room?.status === 'countdown') {
    const count = Math.max(1, Math.ceil(((room.startedAt || now) - now) / 1000));
    return (
      <div className="track-overlay countdown" aria-live="assertive">
        <strong key={count}>{count}</strong>
      </div>
    );
  }
  if (room?.status === 'finished') return <FinishOverlay room={room} />;
  return null;
}

function FinishOverlay({ room }: { room: Room }) {
  const winner = room.winner == null ? null : TEAM_COLORS[room.winner];
  return (
    <div className="track-overlay finish-overlay" aria-label={winner ? `Победители: ${winner.name}` : 'Ничья'}>
      <Trophy size={36} />
      <strong style={{ color: winner?.color }}>{winner?.name || 'Ничья'}</strong>
    </div>
  );
}

export function TeamCards({ room }: RoomProps) {
  return (
    <div className="teams-grid">
      {TEAM_COLORS.map((team, index) => (
        <TeamCard key={team.key} room={room} index={index} />
      ))}
    </div>
  );
}

function TeamCard({ room, index }: RoomProps & { index: number }) {
  const team = TEAM_COLORS[index];
  return (
    <article className="team-card" style={{ '--team': team.color } as CSSProperties}>
      <span className="team-dot" />
      <span className="team-name">{team.name}</span>
      <span className="team-count" aria-label={`${room?.teams[index]?.size || 0} игроков`}>
        <Users size={13} />
        {room?.teams[index]?.size || 0}
      </span>
      <strong className="team-distance">
        {Math.floor(room?.teams[index]?.distance || 0)}
        <small> м</small>
      </strong>
    </article>
  );
}
