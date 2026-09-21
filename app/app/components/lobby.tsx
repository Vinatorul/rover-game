import { useState } from 'react';
import { Check, Copy, Monitor, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { viewLink } from '@/lib/client';
import type { Game } from './use-game';

export function HostPanel({ game }: { game: Game }) {
  return (
    <aside className={`host-panel ${game.room ? '' : 'host-empty'}`} aria-label="Управление гонкой">
      {game.room && <RoomInvite game={game} />}
      {game.room && <DistanceSelect game={game} />}
      <HostControl game={game} />
      <HostLinks game={game} />
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
  const total = room?.teams.reduce((sum, team) => sum + team.size, 0) || 0;
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

function HostLinks({ game }: { game: Game }) {
  if (!game.room) return null;
  const canStop = game.identity?.role === 'host' && ['countdown', 'racing'].includes(game.room.status);
  const stop = () => {
    if (confirm('Остановить заезд и вернуть всех на старт?')) void game.action({ action: 'reset' });
  };
  return (
    <div className="host-links">
      <a className="screen-link" target="_blank" rel="noreferrer" href={viewLink('screen', game.code)}>
        <Monitor size={17} /> Экран
      </a>
      {canStop && (
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
      )}
    </div>
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
      <strong aria-label={`Код комнаты ${game.code}`}>{game.code}</strong>
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
