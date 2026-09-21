import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Flag } from 'lucide-react';
import { TEAM_COLORS, type Room } from '@/lib/game';
import { createTrack, positionOnTrack, TRACK_GOAL, type Track } from '@/lib/track';
import { sceneDepth } from '@/lib/scenery';
import { Rover } from './race';
import { Scenery } from './scenery';

const PARK_TRAILS = [
  { material: 'soil', path: 'M16 22 C8 21 5 16 9 11 C15 3 27 13 36 9 C45 4 52 4 55 10 C56 13 56 16 59 16' },
  { material: 'pavers', path: 'M16 78 C8 82 10 92 23 91 C35 90 39 83 52 87 C66 93 81 96 91 86 C99 77 93 66 79 65' },
  { material: 'pavers', path: 'M16 40 C11 40 8 44 8 50 C8 56 11 60 16 60' },
  { material: 'pavers', path: 'M8 50 C6 64 13 72 23 70 C27 69 30 69 34 69' },
  { material: 'soil', path: 'M9 11 C3 18 3 28 8 33 C10 36 13 40 16 40' },
  { material: 'soil', path: 'M59 16 C66 11 74 15 76 21 C79 28 75 31 70 31' },
  { material: 'soil', path: 'M48 69 C42 71 40 77 44 82 C46 85 49 86 52 87' },
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
      <ParkTrails id={id} surface />
      <CoursePaths tracks={tracks} id={id} />
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
