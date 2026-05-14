"use client";

const DEFAULT_COLOR = "#2962ff";

interface Props {
  highPrice: number;
  lowPrice: number;
  color?: string;
  priceToCoord: (p: number) => number | null;
  chartWidth: number;
  isPreview?: boolean;
  isSelected?: boolean;
  formatPrice: (n: number) => string;
}

export function PriceRangeOverlay({
  highPrice,
  lowPrice,
  color = DEFAULT_COLOR,
  priceToCoord,
  chartWidth,
  isPreview,
  isSelected,
  formatPrice,
}: Props) {
  const yHigh = priceToCoord(highPrice);
  const yLow = priceToCoord(lowPrice);
  if (yHigh === null || yLow === null) return null;

  const top = Math.min(yHigh, yLow);
  const bot = Math.max(yHigh, yLow);
  const h = bot - top;
  const textX = Math.max(0, chartWidth - 72);
  const activeColor = isSelected ? "#2962ff" : color;

  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
      {/* Fill zone */}
      <rect
        x={0}
        y={top}
        width={textX}
        height={h}
        fill={activeColor}
        opacity={isSelected ? 0.12 : 0.07}
      />
      {/* Top border */}
      <line
        x1={0} x2={textX} y1={top} y2={top}
        stroke={activeColor} strokeWidth={isSelected ? 1.5 : 1}
        strokeDasharray={isPreview ? "4,3" : undefined}
        opacity={0.9}
      />
      {/* Bottom border */}
      <line
        x1={0} x2={textX} y1={bot} y2={bot}
        stroke={activeColor} strokeWidth={isSelected ? 1.5 : 1}
        strokeDasharray={isPreview ? "4,3" : undefined}
        opacity={0.9}
      />
      {/* Labels */}
      <text x={textX - 4} y={top - 3} textAnchor="end" fill={activeColor} fontSize="10" fontFamily="monospace">
        {formatPrice(highPrice)}
      </text>
      <text x={textX - 4} y={bot + 11} textAnchor="end" fill={activeColor} fontSize="10" fontFamily="monospace">
        {formatPrice(lowPrice)}
      </text>
    </svg>
  );
}
