"use client";

export interface PixelPoint {
  x: number;
  y: number;
}

function distToSegment(px: number, py: number, a: PixelPoint, b: PixelPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Shortest distance from (px,py) to the polyline through `points`. */
export function distanceToPolyline(px: number, py: number, points: PixelPoint[]): number {
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    min = Math.min(min, distToSegment(px, py, points[i], points[i + 1]));
  }
  return min;
}

/**
 * Renders a multi-point trend line (polyline) over the chart.
 * Coordinates are already converted to pixels by the chart component.
 */
export function TrendLineOverlay({
  points,
  color = "#2962ff",
  isPreview = false,
  isSelected = false,
  extendRight = false,
  chartWidth = 0,
}: {
  points: PixelPoint[];
  color?: string;
  isPreview?: boolean;
  isSelected?: boolean;
  /** Extiende la línea hacia el futuro (borde derecho) como proyección punteada. */
  extendRight?: boolean;
  chartWidth?: number;
}) {
  if (points.length === 0) return null;

  // Single point: just show the placed vertex (start of a new line)
  if (points.length === 1) {
    return (
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
        <circle cx={points[0].x} cy={points[0].y} r={4} fill={color} />
      </svg>
    );
  }

  const ptsStr = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Proyección al futuro: prolonga la última recta hasta el borde derecho.
  let projection: PixelPoint | null = null;
  if (extendRight && points.length >= 2 && chartWidth > 0) {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const dx = last.x - prev.x;
    if (dx > 0.5 && last.x < chartWidth) {
      const t = (chartWidth - last.x) / dx;
      projection = { x: chartWidth, y: last.y + t * (last.y - prev.y) };
    }
  }

  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
      {projection && (
        <line
          x1={points[points.length - 1].x}
          y1={points[points.length - 1].y}
          x2={projection.x}
          y2={projection.y}
          stroke={color}
          strokeWidth={isSelected ? 3 : 2}
          strokeDasharray="6 5"
          strokeOpacity={0.75}
          strokeLinecap="round"
        />
      )}
      <polyline
        points={ptsStr}
        fill="none"
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        strokeDasharray={isPreview ? "5 4" : undefined}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={isSelected ? 4 : 3} fill={color} />
      ))}
    </svg>
  );
}
