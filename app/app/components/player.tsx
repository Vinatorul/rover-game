import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  loadIdentity,
  nextTapPacket,
  request,
  RequestError,
  saveIdentity,
  syncTapQueue,
  viewLink,
  type Mode,
  type RoomResult,
  type TapQueue,
} from '@/lib/client';
import { TEAM_COLORS, type Room } from '@/lib/game';
import { useClock, type Game } from './use-game';

type JoinedRoom = Room & { player: NonNullable<Room['player']> };
type JoinFields = { code: string; setCode: (value: string) => void };

export function JoinPanel({ mode, game }: { mode: Mode; game: Game }) {
  const [code, setCode] = useState(game.code);
  useAutomaticJoin(mode, game);
  const [busy, setBusy] = useState(false);
  const join = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    game.setError('');
    try {
      await joinRoom(mode, code);
    } catch (error) {
      game.setError(error instanceof Error ? error.message : 'Не удалось войти.');
      setBusy(false);
    }
  };
  if (mode === 'player' && game.code && !game.error) return <JoiningRoom />;
  return (
    <div className="join-layout">
      <form className="join-panel" onSubmit={(event) => void join(event)}>
        <RoomCodeInput fields={{ code, setCode }} />
        <JoinSubmit mode={mode} busy={busy} />
      </form>
    </div>
  );
}

async function joinRoom(mode: Mode, code: string) {
  if (mode === 'player') {
    const identity = loadIdentity(mode, code);
    const result = await request<RoomResult>(`/${code}`, identity?.token, { action: 'join' });
    if (result.token) saveIdentity(mode, code, result.token);
  } else await request<Room>(`/${code}`);
  location.assign(viewLink(mode, code));
}

function useAutomaticJoin(mode: Mode, game: Game) {
  const { room, action } = game;
  const attempted = useRef(false);
  useEffect(() => {
    if (mode !== 'player' || !room || room.player || attempted.current) return;
    attempted.current = true;
    void action({ action: 'join' });
  }, [mode, room, action]);
}

function JoiningRoom() {
  return (
    <div className="join-layout">
      <span className="joining-status" role="status">
        Подключаемся…
      </span>
    </div>
  );
}

function RoomCodeInput({ fields }: { fields: JoinFields }) {
  const change = (value: string) =>
    fields.setCode(
      value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6),
    );
  return (
    <>
      <label htmlFor="room-code">Код комнаты</label>
      <Input
        id="room-code"
        value={fields.code}
        onChange={(event) => change(event.target.value)}
        placeholder="ABC123"
        required
        minLength={6}
        maxLength={6}
        autoComplete="off"
        className="code-input"
      />
    </>
  );
}

function JoinSubmit({ mode, busy }: { mode: Mode; busy: boolean }) {
  return (
    <Button className="primary-button" disabled={busy}>
      {busy ? 'Подключаемся…' : mode === 'screen' ? 'Открыть экран' : 'Войти'}
      <ArrowRight />
    </Button>
  );
}

function useGas(game: Game) {
  const queue = useRef<TapQueue>({ key: '', pending: 0, seq: 0, packet: null });
  const current = useRef(game);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    current.current = game;
  }, [game]);
  useTapTransport(current, queue);
  const tap = () => {
    const room = game.room;
    if (room?.status !== 'racing' || !game.connected) return;
    syncTapQueue(queue.current, room, game.identity?.token || '');
    queue.current.pending = Math.min(24, queue.current.pending + 1);
    setBurst((value) => value + 1);
    navigator.vibrate?.(8);
  };
  return { tap, burst };
}

function useTapTransport(current: React.RefObject<Game>, queue: React.RefObject<TapQueue>) {
  useEffect(() => {
    let sending = false;
    let stopped = false;
    const flush = async () => {
      if (sending || stopped) return;
      sending = true;
      await sendTapBatch(current.current, queue.current, () => stopped);
      sending = false;
    };
    const timer = setInterval(() => void flush(), 250);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [current, queue]);
}

async function sendTapBatch(game: Game, queue: TapQueue, stopped: () => boolean) {
  const { room } = game;
  if (room?.status !== 'racing' || !game.identity) return;
  syncTapQueue(queue, room, game.identity.token);
  const key = queue.key;
  const packet = nextTapPacket(queue, room.round);
  if (!packet) return;
  try {
    await request(`/${room.code}`, game.identity.token, packet);
    if (queue.packet === packet) queue.packet = null;
  } catch (error) {
    if (stopped() || queue.key !== key) return;
    if (error instanceof RequestError && error.status < 500 && ![408, 429].includes(error.status)) {
      if (queue.packet === packet) queue.packet = null;
      game.setError(error.message);
    } else game.setConnectionError('Связь прервалась. Переподключаемся…');
  }
}

export function PlayerPanel({ game }: { game: Game }) {
  const { tap, burst } = useGas(game);
  const now = useClock() + game.offset.current;
  if (!game.room?.player) return <JoinPanel mode="player" game={game} />;
  const room = game.room as JoinedRoom;
  const progress = room.teams[room.player.team]?.distance || 0;
  return (
    <section className="player-panel" style={{ '--team': TEAM_COLORS[room.player.team].color } as CSSProperties}>
      <div className="player-meta">
        <span className="player-team">
          <span className="team-dot" />
          {TEAM_COLORS[room.player.team].name}
        </span>
        <span className="player-room" aria-label={`Код комнаты ${room.code}`}>
          {room.code}
        </span>
      </div>
      <GasButton room={room} now={now} connected={game.connected} tap={tap} burst={burst} />
      <div className="player-distance">
        {Math.floor(progress)} <span>/ {room.target} м</span>
      </div>
      <div className="player-progress" aria-label={`Пройдено ${Math.floor(progress)} из ${room.target} метров`}>
        <span style={{ width: `${Math.min(100, (progress / room.target) * 100)}%` }} />
      </div>
    </section>
  );
}

function gasLabel(room: JoinedRoom, now: number) {
  if (room.status === 'countdown') return String(Math.max(1, Math.ceil(((room.startedAt || now) - now) / 1000)));
  if (room.status === 'finished')
    return room.winner === null ? 'Ничья' : room.winner === room.player.team ? 'Победа' : 'Финиш';
  return 'ГАЗ';
}

type GasProps = { room: JoinedRoom; now: number; connected: boolean; tap: () => void; burst: number };
function GasButton({ room, now, connected, tap, burst }: GasProps) {
  const racing = room.status === 'racing';
  return (
    <button
      className={`gas-button ${racing ? 'ready' : ''}`}
      onClick={tap}
      onKeyDown={(event) => {
        if (event.repeat) event.preventDefault();
      }}
      disabled={!racing || !connected}
      aria-label="ГАЗ — ускорить ровер"
    >
      <strong>{gasLabel(room, now)}</strong>
      {!connected ? <span>Подключаемся…</span> : room.status === 'lobby' && <span>Ждём старта</span>}
      {burst > 0 && racing && (
        <i key={burst} className="tap-burst">
          +1
        </i>
      )}
    </button>
  );
}
