/**
 * CrackEffect - SVG crack overlay that animates when enemy becomes defeatable.
 *
 * Renders crack lines radiating from center that animate with stroke-dashoffset.
 * After animation completes, enemy token grayscales.
 */

import "./CrackEffect.css";

interface CrackEffectProps {
  /** Whether to show the crack effect (enemy can be defeated) */
  active: boolean;
  /** Size of the effect (matches enemy token size) */
  size?: number;
}

export function CrackEffect({ active, size = 200 }: CrackEffectProps) {
  if (!active) return null;

  const center = size / 2;
  const radius = size * 0.45; // Cracks extend to near edge

  // Generate crack paths radiating from center
  // Each crack has slight randomized angles and lengths
  const cracks = [
    // Main cracks - 5 primary directions
    { angle: -30, length: radius * 0.95, offset: 0 },
    { angle: 45, length: radius * 0.85, offset: 20 },
    { angle: 120, length: radius * 0.9, offset: 40 },
    { angle: 180, length: radius * 0.88, offset: 60 },
    { angle: -80, length: radius * 0.92, offset: 80 },
    // Secondary cracks - shorter, fill gaps
    { angle: 10, length: radius * 0.6, offset: 100 },
    { angle: 75, length: radius * 0.55, offset: 120 },
    { angle: 150, length: radius * 0.65, offset: 140 },
    { angle: -120, length: radius * 0.5, offset: 160 },
  ];

  // Convert angle + length to path
  const crackPaths = cracks.map((crack, i) => {
    const rad = (crack.angle * Math.PI) / 180;
    const endX = center + Math.cos(rad) * crack.length;
    const endY = center + Math.sin(rad) * crack.length;

    // Add slight curve for organic look
    const midX = center + Math.cos(rad) * crack.length * 0.5 + (Math.random() - 0.5) * 8;
    const midY = center + Math.sin(rad) * crack.length * 0.5 + (Math.random() - 0.5) * 8;

    return {
      d: `M ${center} ${center} Q ${midX} ${midY} ${endX} ${endY}`,
      delay: crack.offset,
      key: i,
    };
  });

  return (
    <div className="crack-effect">
      <svg
        className="crack-effect__svg"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
      >
        {/* Glow filter for crack lines */}
        <defs>
          <filter id="crack-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Crack lines */}
        {crackPaths.map((crack) => (
          <path
            key={crack.key}
            className="crack-effect__line"
            d={crack.d}
            style={{ animationDelay: `${crack.delay}ms` }}
            filter="url(#crack-glow)"
          />
        ))}

        {/* Central impact point */}
        <circle
          className="crack-effect__impact"
          cx={center}
          cy={center}
          r={8}
        />
      </svg>
    </div>
  );
}
