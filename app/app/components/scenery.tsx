import type { CSSProperties } from 'react';
import { plantsByDepth, sceneDepth, type Plant } from '@/lib/scenery';

export function Scenery() {
  return (
    <>
      {plantsByDepth().map((plant) => (
        <Vegetation key={plant.id} plant={plant} />
      ))}
    </>
  );
}

function Vegetation({ plant }: { plant: Plant }) {
  const style = {
    left: `${plant.x}%`,
    top: `${plant.y}%`,
    zIndex: sceneDepth(plant.y),
    '--plant-width': `${plant.width}%`,
    '--plant-max': `${plant.maxWidth}px`,
  } as CSSProperties;
  return <span className={`vegetation-sprite vegetation-${plant.kind}`} style={style} aria-hidden="true" />;
}
