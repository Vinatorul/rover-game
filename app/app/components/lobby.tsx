import { useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { viewLink } from '@/lib/client';
import type { Game } from './use-game';

export function HostPanel({ game }: { game: Game }) {
  return (
    <aside className={`host-panel ${game.room ? '' : 'host-empty'}`} aria-label="Управление гонкой">
      {game.room && (
        <div className="host-settings">
          <DistanceSelect game={game} />
          <RoomInvite game={game} />
        </div>
      )}
      <div className="host-actions">
        <HostControl game={game} />
        <StopRace game={game} />
      </div>
    </aside>
  );
}

function DistanceSelect({ game }: { game: Game }) {
  const { room, busy, identity, action } = game;
  return (
    <Select
      value={String(room?.target || 300)}
      disabled={room?.status !== 'lobby' || identity?.role !== 'host' || busy}
      onValueChange={(target) => void action({ action: 'settings', target: Number(target) })}
    >
      <SelectTrigger aria-label="Дистанция гонки">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[150, 300, 500].map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n} м
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function controlState(game: Game) {
  const { room, busy, identity } = game;
  const total = room?.racers.length || 0;
  if (!room) return { text: busy ? 'Создаём…' : 'Создать комнату', disabled: busy, action: '' };
  if (room.status === 'lobby')
    return {
      text: !total ? 'Ждём игроков' : busy ? 'Запускаем…' : 'Старт',
      disabled: !total || busy || identity?.role !== 'host',
      action: 'start',
    };
  return {
    text: room.status === 'finished' ? 'Ещё раз' : 'Гонка идёт',
    disabled: busy || identity?.role !== 'host' || room.status !== 'finished',
    action: 'reset',
  };
}

function HostControl({ game }: { game: Game }) {
  const control = controlState(game);
  return (
    <Button
      className="primary-button"
      disabled={control.disabled}
      onClick={() => void game.action({ action: control.action }, !game.room)}
    >
      {control.text}
    </Button>
  );
}

function StopRace({ game }: { game: Game }) {
  if (!game.room) return null;
  const canStop = game.identity?.role === 'host' && ['countdown', 'racing'].includes(game.room.status);
  if (!canStop) return null;
  const stop = () => {
    if (confirm('Остановить заезд и вернуть всех на старт?')) void game.action({ action: 'reset' });
  };
  return (
    <Button
      variant="ghost"
      className="reset-button"
      aria-label="Остановить заезд"
      title="Остановить заезд"
      disabled={game.busy}
      onClick={stop}
    >
      <RotateCcw size={17} />
    </Button>
  );
}

function RoomInvite({ game }: { game: Game }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(viewLink('player', game.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      game.setError('Не удалось скопировать приглашение. Попробуй ещё раз.');
    }
  };
  return (
    <div className="room-invite">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void copy()}
        aria-label={copied ? 'Ссылка скопирована' : 'Скопировать приглашение'}
        title="Скопировать приглашение"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
