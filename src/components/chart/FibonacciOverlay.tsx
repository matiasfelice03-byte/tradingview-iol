"use client";

export const RETRACEMENT_LEVELS = [
  { ratio: 0, label: "0%", color: "#787b86" },
  { ratio: 0.236, label: "23.6%", color: "#f44336" },
  { ratio: 0.382, label: "38.2%", color: "#ff9800" },
  { ratio: 0.5, label: "50%", color: "#ffeb3b" },
  { ratio: 0.618, label: "61.8%", color: "#26a69a" },
  { ratio: 0.786, label: "78.6%", color: "#2196f3" },
  { ratio: 1, label: "100%", color: "#787b86" },
];

export const EXTENSION_LEVELS = [
  ...RETRACEMENT_LEVELS,
  { ratio: 1.272, label: "127.2%", color: "#ab47bc" },
  { ratio: 1.414, label: "141.4%", color: "#7b1fa2" },
  { ratio: 1.618, label: "161.8%", color: "#26a69a" },
  { ratio: 2.0, label: "200%", color: "#f44336" },
  { ratio: 2.618, label: "261.8%", color: "#b71c1c" },
];

export interface FibLevelRendered {
  ratio: number;
  label: string;
  price: number;
  y: number;
  color: string;
}

export function computeFibLevels(
  highPrice: number,
  lowPrice: number,
  type: "retracement" | "extension",
  priceToCoord: (price: number) => number | null,
  tintColor?: string,
): FibLevelRendered[] {
  const range = highPrice - lowPrice;
  const levels = type === "extension" ? EXTENSION_LEVELS : RETRACEMENT_LEVELS;
  const result: FibLevelRendered[] = [];
  for (const l of levels) {
    const price = highPrice - range * l.ratio;
    const y = priceToCoord(price);
    if (y !== null) result.push({ ...l, color: tintColor ?? l.color, price, y });
  }
  return result;
}

/**
 * Extensión de Fibonacci de 3 puntos (trend-based):
 * A = inicio del impulso, B = fin del impulso, C = fin del retroceso.
 * Los niveles se proyectan desde C: price = C + (B - A) * ratio.
 */
export function computeFibExtensionLevels(
  a: number,
  b: number,
  c: number,
  priceToCoord: (price: number) => number | null,
  tintColor?: string,
): FibLevelRendered[] {
  const impulse = b - a;
  const result: FibLevelRendered[] = [];
  for (const l of EXTENSION_LEVELS) {
    const price = c + impulse * l.ratio;
    const y = priceToCoord(price);
    if (y !== null) result.push({ ...l, color: tintColor ?? l.color, price, y });
  }
  return result;
}

interface Props {
  levels: FibLevelRendered[];
  chartWidth: number;
  isPreview?: boolean;
  isSelected?: boolean;
  formatPrice: (n: number) => string;
}

export function FibonacciOverlay({ levels, chartWidth, isPreview, isSelected, formatPrice }: Props) {
  if (levels.length === 0) return null;
  const textX = Math.max(0, chartWidth - 72);
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
    >
      {levels.map((l, i) => {
        const next = levels[i + 1];
        return (
          <g key={l.ratio}>
            {next && (
              <rect
                x={0}
                y={Math.min(l.y, next.y)}
                width={textX}
                height={Math.abs(next.y - l.y)}
                fill={isSelected ? "#2962ff" : l.color}
                opacity={isSelected ? 0.06 : 0.04}
              />
            )}
            <line
              x1={0}
              x2={textX}
              y1={l.y}
              y2={l.y}
              stroke={isSelected ? "#2962ff" : l.color}
              strokeWidth={isSelected ? 1.5 : 1}
              strokeDasharray={isPreview ? "4,3" : undefined}
              opacity={0.85}
            />
            <text
              x={textX - 4}
              y={l.y - 3}
              textAnchor="end"
              fill={isSelected ? "#2962ff" : l.color}
              fontSize="10"
              fontFamily="monospace"
            >
              {l.label} · {formatPrice(l.price)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
