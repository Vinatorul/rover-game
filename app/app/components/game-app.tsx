import { WifiOff } from 'lucide-react';
import type { Mode } from '@/lib/client';
import { HostPanel } from './lobby';
import { RoomQr } from './room-qr';
import { PlayerPanel } from './player';
import { RaceTrack, RacerCards } from './race';
import { useGame, type Game } from './use-game';

export function GameApp({ mode }: { mode: Mode }) {
  const game = useGame(mode);
  return (
    <div className={`app-shell mode-${mode === 'player' ? 'player' : 'screen'}`}>
      <ErrorBanner game={game} />
      <main className="main-content">{mode === 'player' ? <PlayerPanel game={game} /> : <HostView game={game} />}</main>
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
    <div className="screen-race">
      <div className="screen-field">
        <RaceTrack room={game.room} offset={game.offset.current} />
        {game.room && <RacerCards room={game.room} />}
      </div>
      <div className="screen-sidebar">
        {game.room && <RoomQr code={game.code} />}
        {(!game.room || game.identity?.role === 'host') && <HostPanel game={game} />}
      </div>
    </div>
  );
}
