type RobotProps = {
  x: number;
  y: number;
  scale?: number;
  body: string;
  dark: string;
};

/** Cute flat robot: dome head with visor, rounded body, stubby arms. */
function Robot({ x, y, scale = 1, body, dark }: RobotProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* shadow */}
      <ellipse cx="0" cy="52" rx="34" ry="8" fill="#101828" opacity="0.10" />
      {/* arms */}
      <rect x="-34" y="2" width="12" height="30" rx="6" fill={body} />
      <rect x="22" y="2" width="12" height="30" rx="6" fill={body} />
      {/* body */}
      <rect x="-26" y="-6" width="52" height="48" rx="14" fill={body} />
      <circle cx="0" cy="18" r="7" fill={dark} opacity="0.55" />
      <circle cx="0" cy="18" r="3" fill="#ffffff" opacity="0.85" />
      {/* head */}
      <path d="M -22 -6 A 22 22 0 0 1 22 -6 Z" fill={body} />
      <rect x="-19" y="-26" width="38" height="20" rx="10" fill={dark} />
      <circle cx="-8" cy="-16" r="4.5" fill="#ffffff" />
      <circle cx="8" cy="-16" r="4.5" fill="#ffffff" />
      <circle cx="-8" cy="-16" r="2" fill={dark} />
      <circle cx="8" cy="-16" r="2" fill={dark} />
      {/* antenna */}
      <line x1="0" y1="-28" x2="0" y2="-36" stroke={body} strokeWidth="4" strokeLinecap="round" />
      <circle cx="0" cy="-38" r="4" fill={body} />
    </g>
  );
}

/** Isometric arena: platform slabs, central code cube, three agent robots. */
export function ArenaArt() {
  return (
    <svg
      viewBox="0 0 640 470"
      className="h-auto w-full"
      role="img"
      aria-label="Three swarm agents debating around a code cube"
    >
      <defs>
        <linearGradient id="cubeTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9b8afb" />
          <stop offset="1" stopColor="#7a5af8" />
        </linearGradient>
        <linearGradient id="cubeLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#53389e" />
          <stop offset="1" stopColor="#3e2a7a" />
        </linearGradient>
        <linearGradient id="cubeRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6941c6" />
          <stop offset="1" stopColor="#4a2fa0" />
        </linearGradient>
        <marker id="arrowB" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#2e90fa" />
        </marker>
        <marker id="arrowR" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#f04452" />
        </marker>
        <marker id="arrowG" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#12b76a" />
        </marker>
      </defs>

      {/* floating deco cubes */}
      <g opacity="0.9">
        <rect x="52" y="120" width="26" height="26" rx="4" fill="#d7e3f8" />
        <rect x="560" y="90" width="22" height="22" rx="4" fill="#d3f8df" />
        <rect x="586" y="300" width="26" height="26" rx="4" fill="#fbd7dc" />
        <rect x="36" y="300" width="20" height="20" rx="4" fill="#e6defc" />
      </g>

      {/* platform: stacked isometric slabs */}
      <g>
        <polygon points="320,400 560,280 320,160 80,280" fill="#eef1f5" />
        <polygon points="80,280 320,400 320,420 80,300" fill="#d5dbe3" />
        <polygon points="560,280 320,400 320,420 560,300" fill="#c3ccd7" />
        <polygon points="80,300 320,420 320,434 80,314" fill="#e3e8ee" />
        <polygon points="560,300 320,420 320,434 560,314" fill="#cfd6df" />
        {/* grid lines on top face */}
        <g stroke="#d3dae3" strokeWidth="1.5">
          <line x1="200" y1="220" x2="440" y2="340" />
          <line x1="260" y1="190" x2="500" y2="310" />
          <line x1="140" y1="250" x2="380" y2="370" />
          <line x1="200" y1="340" x2="440" y2="220" />
          <line x1="140" y1="310" x2="380" y2="190" />
          <line x1="260" y1="370" x2="500" y2="250" />
        </g>
      </g>

      {/* debate arrows */}
      <g fill="none" strokeWidth="3">
        <path d="M 205 235 C 240 210, 270 210, 292 228" stroke="#2e90fa" markerEnd="url(#arrowB)" />
        <path d="M 320 130 C 320 160, 320 175, 320 195" stroke="#f04452" markerEnd="url(#arrowR)" />
        <path d="M 445 235 C 410 210, 380 210, 358 228" stroke="#12b76a" markerEnd="url(#arrowG)" />
      </g>

      {/* robots */}
      <Robot x={170} y={265} scale={1.15} body="#2e90fa" dark="#122a4d" />
      <Robot x={322} y={150} scale={0.95} body="#f04452" dark="#4d1220" />
      <Robot x={478} y={265} scale={1.15} body="#12b76a" dark="#0b3d28" />

      {/* central code cube */}
      <g transform="translate(320 285)">
        <polygon points="0,-46 40,-23 0,0 -40,-23" fill="url(#cubeTop)" />
        <polygon points="-40,-23 0,0 0,46 -40,23" fill="url(#cubeLeft)" />
        <polygon points="40,-23 0,0 0,46 40,23" fill="url(#cubeRight)" />
        <text x="-20" y="28" textAnchor="middle" fontSize="17" fontWeight="700" fill="#ffffff" fontFamily="monospace">
          &lt;/&gt;
        </text>
        <text x="20" y="28" textAnchor="middle" fontSize="17" fontWeight="700" fill="#ffffff" fontFamily="monospace">
          &lt;/&gt;
        </text>
        {/* label pill */}
        <rect x="-92" y="58" width="184" height="34" rx="8" fill="#101828" />
        <text
          x="0"
          y="80"
          textAnchor="middle"
          fontSize="14"
          fontWeight="800"
          letterSpacing="2"
          fill="#ffffff"
          fontFamily="Inter, system-ui, sans-serif"
        >
          SWARM DEBUGGER
        </text>
      </g>
    </svg>
  );
}
