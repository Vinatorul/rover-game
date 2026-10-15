import type { CSSProperties } from 'react';
import { Trophy } from 'lucide-react';
import { ROVER_COLORS, type Racer, type Room } from '@/lib/game';
import { useClock } from './use-game';
import { TrackCourse } from './track-course';
import './solo-race.css';

type RoomProps = { room: Room | null };

export function Rover({ color, number, className = '' }: { color: number; number: number; className?: string }) {
  return (
    <div
      className={`rover-sprite ${className}`}
      role="img"
      aria-label={`Ровер №${number}`}
      style={{
        backgroundPosition: `${color % 2 ? 100 : 0}% ${color > 1 ? 100 : 0}%`,
        clipPath: color > 1 ? 'inset(2.2% 0 0)' : undefined,
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
  if (room?.status !== 'finished') return null;
  return <FinishResult room={room} />;
}

function FinishResult({ room }: { room: Room }) {
  const winner = room.racers.find((racer) => racer.number === room.winner);
  const style = { '--winner-color': winner ? ROVER_COLORS[winner.color].color : '#fff6dc' } as CSSProperties;
  return (
    <div
      className="solo-finish-result"
      role="status"
      style={style}
      aria-label={winner ? `Победитель: ровер №${winner.number}` : 'Ничья'}
    >
      <Trophy size={24} aria-hidden="true" />
      <strong>{winner ? `№${winner.number}` : 'Ничья'}</strong>
    </div>
  );
}

export function RacerCards({ room }: RoomProps) {
  if (!room?.racers.length) return null;
  return (
    <div className="solo-racers">
      {room.racers.map((racer) => (
        <RacerCard key={racer.number} racer={racer} />
      ))}
    </div>
  );
}

function RacerCard({ racer }: { racer: Racer }) {
  return (
    <article className="solo-racer-card" style={{ '--team': ROVER_COLORS[racer.color].color } as CSSProperties}>
      <span className="solo-racer-number">№{racer.number}</span>
      <strong>
        {Math.floor(racer.distance)}
        <small> м</small>
      </strong>
    </article>
  );
}
