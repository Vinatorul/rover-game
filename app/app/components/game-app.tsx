import { WifiOff } from 'lucide-react';
import type { Mode } from '@/lib/client';
import { HostPanel } from './lobby';
import { RoomQr } from './room-qr';
import { JoinPanel, PlayerPanel } from './player';
import { RaceTrack, TeamCards } from './race';
import { useGame, type Game } from './use-game';

export function GameApp({ mode }: { mode: Mode }) {
  const game = useGame(mode);
  return (
    <div className={`app-shell mode-${mode}`}>
      <ErrorBanner game={game} />
      <main className="main-content">
        {mode === 'host' ? (
          <HostView game={game} />
        ) : mode === 'screen' ? (
          <ScreenView game={game} />
        ) : (
          <PlayerPanel game={game} />
        )}
      </main>
    </div>
  );
}

function ErrorBanner({ game }: { game: Game }) {
  if (!game.error) return null;
  return (
    <div className="error-banner" role="alert">
      <WifiOff size={17} />
      <span>{game.error}</span>
      <button
        aria-label="Закрыть сообщение"
        onClick={() => {
          game.setError('');
          game.setConnectionError('');
        }}
      >
        ×
      </button>
    </div>
  );
}

function HostView({ game }: { game: Game }) {
  return (
    <div className="host-layout">
      <div className="race-column">
        <RaceTrack room={game.room} offset={game.offset.current} />
        {game.room && <TeamCards room={game.room} />}
      </div>
      <HostPanel game={game} />
    </div>
  );
}

function ScreenView({ game }: { game: Game }) {
  if (!game.room) return <JoinPanel mode="screen" game={game} />;
  return (
    <div className="screen-race">
      <div className="screen-field">
        <RaceTrack room={game.room} offset={game.offset.current} />
        <TeamCards room={game.room} />
      </div>
      <RoomQr code={game.code} />
    </div>
  );
}
