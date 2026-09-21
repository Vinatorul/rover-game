import { Flag, Monitor, Radio, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { viewLink, type Mode } from '@/lib/client';
import { Button } from '@/components/ui/button';

type HeaderProps = { mode: Mode; code: string; sound: boolean; onSound: () => void };
const views = [
  { mode: 'host', label: 'Ведущий', Icon: Radio },
  { mode: 'screen', label: 'Большой экран', Icon: Monitor },
  { mode: 'player', label: 'Игрок', Icon: Smartphone },
] as const;

export function Header({ mode, code, sound, onSound }: HeaderProps) {
  return (
    <header className="app-header">
      <Brand />
      <ViewNavigation mode={mode} code={code} />
      <Button
        variant="ghost"
        size="icon"
        className="sound-button"
        onClick={onSound}
        aria-label={sound ? 'Выключить звук' : 'Включить звук'}
      >
        {sound ? <Volume2 /> : <VolumeX />}
      </Button>
    </header>
  );
}

function ViewNavigation({ mode, code }: Pick<HeaderProps, 'mode' | 'code'>) {
  return (
    <nav className="view-nav" aria-label="Экраны игры">
      {views.map((view) => (
        <a
          key={view.mode}
          aria-label={view.label}
          className={mode === view.mode ? 'active' : ''}
          href={viewLink(view.mode, code)}
        >
          <view.Icon />
          <span>{view.label}</span>
        </a>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <a className="brand" href={viewLink('host')} aria-label="Ровер-ралли — главная">
      <span className="brand-icon">
        <Flag size={23} fill="currentColor" />
      </span>
      <span>
        ровер<span className="brand-muted"> / </span>ралли<span className="brand-period">.</span>
      </span>
    </a>
  );
}
