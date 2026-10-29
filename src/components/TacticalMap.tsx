export default function TacticalMap({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={`tactical-map ${large ? "large" : ""}`}
      viewBox="0 0 300 220"
      aria-label="Erangel island tactical map"
      role="img"
    >
      <defs>
        <pattern
          id="map-grid"
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M30 0H0v30"
            fill="none"
            stroke="#bcc6aa"
            strokeOpacity=".15"
            strokeWidth=".5"
          />
        </pattern>
        <filter id="map-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".09"
            numOctaves="3"
            seed="8"
          />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope=".22" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      <rect width="300" height="220" fill="#192c30" />
      <g filter="url(#map-grain)">
        <path
          d="m40 56 24-22 33 8 18-19 45 10 18-13 29 24 32 8 14 30-5 27 15 21-20 21-6 24-38 8-19-13-27 8-20-10-29 13-26-17-24-3-9-27-18-11 12-30-8-22Z"
          fill="#69725b"
        />
        <path
          d="m116 186 20-8 28 7 21-4 16 17-13 16-32-2-15 7-25-13-19-2 2-15Z"
          fill="#687159"
        />
        <path
          d="m56 65 28 15 20-20 20 15 30-26 32 20 28-3 25 26-24 19-20-9-30 24-32-15-21 13-26-21-25 5Z"
          fill="#525e48"
        />
        <path
          d="m50 122 39-14 23 15 29-3 23 19 27-8 34 17-21 15-31-10-22 12-27-20-21 12-30-13-16 4Z"
          fill="#7a7e5e"
        />
      </g>
      <g stroke="#c9bea1" strokeWidth="1.3" opacity=".7" fill="none">
        <path d="m65 66 37 31 43 5 29-17 44 13 19 39M86 149l22-34 37-13 9 40 23 22M145 102l-5-41M154 143l-6 50M190 150l-15 40" />
        <path d="m55 118 54-2 10 24 37 2 25-22 33 5" strokeWidth=".7" />
      </g>
      <g fill="#c8bf9c" opacity=".8">
        {[
          [96, 94],
          [105, 98],
          [113, 93],
          [137, 99],
          [143, 106],
          [153, 97],
          [154, 106],
          [162, 104],
          [176, 84],
          [184, 86],
          [207, 96],
          [212, 104],
          [110, 136],
          [118, 140],
          [177, 145],
          [183, 151],
          [151, 191],
        ].map(([x, y], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width="4"
            height="3"
            transform={`rotate(${i * 13} ${x} ${y})`}
          />
        ))}
      </g>
      <rect width="300" height="220" fill="url(#map-grid)" />
      <circle
        cx="151"
        cy="103"
        r="30"
        fill="none"
        stroke="#ede6c9"
        strokeOpacity=".5"
        strokeWidth=".7"
      />
      <path d="m151 97 4 10-4-2-4 2 4-10Z" fill="#e9b454" />
      {large && (
        <g fill="#ece8d7" fontSize="7" fontFamily="monospace" letterSpacing="1">
          <text x="126" y="123">
            POCHINKI
          </text>
          <text x="166" y="76">
            ROZHOK
          </text>
          <text x="76" y="86">
            GATKA
          </text>
          <text x="128" y="205">
            MILITARY BASE
          </text>
          <text x="14" y="18" fill="#d5bd86">
            N
          </text>
          <path d="M17 26v14m-3-10 3-4 3 4" stroke="#d5bd86" fill="none" />
        </g>
      )}
    </svg>
  );
}
