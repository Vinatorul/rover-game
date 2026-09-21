import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Flag } from 'lucide-react';
import { TEAM_COLORS, type Room } from '@/lib/game';
import { createTrack, positionOnTrack, TRACK_GOAL, type Track } from '@/lib/track';
import { sceneDepth } from '@/lib/scenery';
import { Rover } from './race';
import { Scenery } from './scenery';

const PARK_TRAILS = [
  { material: 'soil', path: 'M16 22 C24 22 22 8 32 8 C43 8 47 16 59 16' },
  { material: 'pavers', path: 'M16 78 C25 78 23 91 35 91 C43 91 47 87 55 87 C67 87 67 65 79 65' },
  { material: 'pavers', path: 'M16 60 C23 60 22 72 29 72 C38 72 34 54 45 54 C54 54 52 43 61 43' },
  { material: 'pavers', path: 'M30 22 C36 22 38 39 46 39 C54 39 57 23 65 23 C73 23 73 35 79 35' },
  { material: 'soil', path: 'M16 40 C22 40 22 48 28 48 C32 48 32 41 36 41' },
  { material: 'soil', path: 'M59 16 C67 16 73 18 77 26 C81 34 82 50 90 50' },
  { material: 'soil', path: 'M48 69 C54 69 54 81 61 81 C69 81 71 65 79 65' },
];

function useTrackAspect() {
  const ref = useRef<HTMLDivElement>(null),
    [aspect, setAspect] = useState(2);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (height) setAspect(width / height);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, aspect };
}

export function TrackCourse({ room, children }: { room: Room | null; children: React.ReactNode }) {
  const { ref, aspect } = useTrackAspect();
  const tracks = useMemo(() => TEAM_COLORS.map((_, index) => createTrack(index, aspect)), [aspect]);
  return (
    <div ref={ref} className={`race-track ${room?.status === 'racing' ? 'racing' : ''}`}>
      <CourseLines tracks={tracks} aspect={aspect} />
      <span className="course-goal" style={{ left: `${TRACK_GOAL.x}%`, top: `${TRACK_GOAL.y}%` }} aria-label="Финиш">
        <Flag aria-hidden="true" />
      </span>
      <Scenery />
      {tracks.map((track, index) => (
        <CourseRover key={index} track={track} room={room} index={index} />
      ))}
      {children}
    </div>
  );
}

function CourseLines({ tracks, aspect }: { tracks: Track[]; aspect: number }) {
  const id = useId();
  return (
    <svg
      className="course-lines"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label="Четыре парковые дорожки одинаковой длины к общему финишу"
    >
      <PathMaterials id={id} aspect={aspect} />
      <ParkTrails id={id} />
      <CoursePaths tracks={tracks} id={id} />
      <ParkTrails id={id} surface />
      <CoursePaths tracks={tracks} id={id} surface />
    </svg>
  );
}

function PathMaterials({ id, aspect }: { id: string; aspect: number }) {
  const width = 12 / aspect;
  return (
    <defs>
      {['pavers', 'soil'].map((material) => (
        <pattern key={material} id={`${id}-${material}`} patternUnits="userSpaceOnUse" width={width} height={12}>
          <image href={`/park-${material}-painted.webp`} width={width} height={12} preserveAspectRatio="none" />
        </pattern>
      ))}
    </defs>
  );
}

function CoursePaths({ tracks, id, surface = false }: { tracks: Track[]; id: string; surface?: boolean }) {
  return (
    <g className={surface ? 'path-surface' : 'path-curbs'}>
      {tracks.map((track, i) => {
        const material = i % 2 ? 'soil' : 'pavers';
        return (
          <path
            key={i}
            className={`path-${material}`}
            d={track.path}
            stroke={surface ? `url(#${id}-${material})` : undefined}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}

function ParkTrails({ id, surface = false }: { id: string; surface?: boolean }) {
  return (
    <g className={`park-trails ${surface ? 'path-surface' : 'path-curbs'}`} aria-hidden="true">
      {PARK_TRAILS.map(({ material, path }, index) => (
        <path
          key={index}
          className={`path-${material}`}
          d={path}
          stroke={surface ? `url(#${id}-${material})` : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

function CourseRover({ track, room, index }: { track: Track; room: Room | null; index: number }) {
  const progress = (room?.teams[index]?.distance || 0) / (room?.target || 300);
  const position = positionOnTrack(track, progress),
    color = TEAM_COLORS[index].color;
  return (
    <div
      className="course-rover"
      style={
        {
          left: `${position.x}%`,
          top: `${position.y}%`,
          zIndex: sceneDepth(position.y),
          '--team': color,
        } as CSSProperties
      }
    >
      <span className="rover-shadow" />
      <Rover team={index} />
      <span className="racer-badge">{index + 1}</span>
    </div>
  );
}
