export function RoverOpening() {
  return (
    <div className="solo-celebration" aria-label="Крышка открывается, из ровера вылетает букет невесты">
      <span className="solo-rover-opening" />
      <span className="solo-rover-lid" />
      <span className="solo-petal solo-petal-one" />
      <span className="solo-petal solo-petal-two" />
      <span className="solo-petal solo-petal-three" />
    </div>
  );
}

export function BouquetFlight() {
  return (
    <div className="solo-bouquet-flight" role="img" aria-label="Букет невесты">
      <Bouquet />
    </div>
  );
}

export function Bouquet() {
  return (
    <svg className="solo-bouquet" viewBox="0 0 110 140" aria-hidden="true">
      <g fill="none" stroke="#617d51" strokeWidth="4" strokeLinecap="round">
        <path d="M53 119 30 48M56 119 77 43M54 121 53 35M57 116 87 68M52 119 23 73" />
      </g>
      <g fill="#819967" stroke="#526f45" strokeWidth="1.5">
        <path d="M45 87Q14 86 14 65Q40 62 45 87ZM63 87Q94 85 97 59Q70 61 63 87Z" />
        <path d="M49 69Q23 48 39 30Q57 42 49 69ZM62 65Q57 35 76 29Q85 51 62 65Z" />
      </g>
      <BouquetFlowers />
      <path d="m43 103 23-2-5 22-11 1Z" fill="#f4dfbe" stroke="#c6a581" strokeWidth="1.5" />
      <path
        d="M55 107Q30 91 32 108Q36 119 55 107Q76 91 77 105Q76 118 55 107L43 136M55 107 70 132"
        fill="#f9ece5"
        stroke="#ceaaa0"
        strokeWidth="2"
      />
    </svg>
  );
}

function BouquetFlowers() {
  return (
    <>
      <g fill="#f6ead9" stroke="#d3b9a4" strokeWidth="1.4">
        <Flower x={29} y={58} />
        <Flower x={74} y={49} />
        <Flower x={55} y={34} />
      </g>
      <g fill="#eeb7b5" stroke="#bd8587" strokeWidth="1.4">
        <Flower x={49} y={59} />
        <Flower x={79} y={72} />
      </g>
    </>
  );
}

function Flower({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse key={angle} cy="-7" rx="7" ry="10" transform={`rotate(${angle})`} />
      ))}
      <circle r="7" fill="#f7eee0" />
      <path d="M-3 1Q-5-6 2-4Q7-2 2 4" fill="none" />
    </g>
  );
}
