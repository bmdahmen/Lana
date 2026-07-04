"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  useIsTooltipActive,
  useActiveTooltipDataPoints,
} from "recharts";
import { NET_WORTH_DISPLAY_CLASSES } from "@/lib/asset-classes";
import { formatCompactCurrency, formatDate } from "@/lib/format";
import type { NetWorthByClassPoint } from "@/lib/net-worth-range";

/**
 * Renders nothing -- it just mirrors recharts' internal hover/scrub state
 * (shared via the chart's context) out to the parent, so the values below
 * the chart can update live instead of a floating tooltip box rendering
 * every series value at once.
 */
function ScrubTracker({
  onScrub,
}: {
  onScrub: (point: NetWorthByClassPoint | null) => void;
}) {
  const active = useIsTooltipActive();
  const dataPoints = useActiveTooltipDataPoints();

  useEffect(() => {
    if (!active || !dataPoints || dataPoints.length === 0) {
      onScrub(null);
      return;
    }
    onScrub(dataPoints[0] as NetWorthByClassPoint);
  }, [active, dataPoints, onScrub]);

  return null;
}

/** How long to ignore hover updates after a touch ends. Mobile browsers fire
 * synthetic compatibility mousemove/mousedown/mouseup events shortly after
 * touchend (for pages that only listen for mouse events); without this,
 * that synthetic mousemove re-activates the scrub state right after the
 * user lifts their finger, with no further mouseleave to clear it. */
const TOUCH_MOUSE_SUPPRESS_MS = 500;

export function NetWorthByClassChart({
  points,
  onScrub,
}: {
  points: NetWorthByClassPoint[];
  onScrub?: (point: NetWorthByClassPoint | null) => void;
}) {
  const suppressMouseUntilRef = useRef(0);

  const handleScrub = useCallback(
    (point: NetWorthByClassPoint | null) => {
      if (Date.now() < suppressMouseUntilRef.current) return;
      onScrub?.(point);
    },
    [onScrub]
  );

  const handleReleased = useCallback(() => onScrub?.(null), [onScrub]);

  const handleTouchEnded = useCallback(() => {
    suppressMouseUntilRef.current = Date.now() + TOUCH_MOUSE_SUPPRESS_MS;
    onScrub?.(null);
  }, [onScrub]);

  if (points.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-zinc-500">
        Not enough history yet — check back after a few days of syncing.
      </div>
    );
  }

  const activeClasses = NET_WORTH_DISPLAY_CLASSES.filter((cls) =>
    points.some((p) => Number(p[cls.id] ?? 0) !== 0)
  );

  return (
    <div
      onTouchEnd={handleTouchEnded}
      onTouchCancel={handleTouchEnded}
      onPointerUp={handleReleased}
      onPointerLeave={handleReleased}
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points} margin={{ left: -16, right: 8 }}>
          {onScrub && <ScrubTracker onScrub={handleScrub} />}
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatDate(d)}
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            minTickGap={40}
            stroke="var(--chart-axis)"
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactCurrency(v)}
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            width={48}
            stroke="var(--chart-axis)"
          />
          {/* No content: we read the hover/scrub state via hooks above and
              render the values below the chart instead of a floating box. */}
          <Tooltip content={() => null} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="net_worth"
            name="Net Worth"
            stroke="var(--chart-net-worth)"
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
          />
          {activeClasses.map((cls) => (
            <Line
              key={cls.id}
              type="monotone"
              dataKey={cls.id}
              name={cls.label}
              stroke={`var(${cls.colorVar})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
