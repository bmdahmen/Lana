"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  visibleKeys,
  totalLabel = "Net Worth",
}: {
  points: NetWorthByClassPoint[];
  onScrub?: (point: NetWorthByClassPoint | null) => void;
  /** Restricts which lines render (net_worth + asset-class ids). Omit to show
   *  every class with nonzero data, plus the Net Worth total, as before --
   *  the Y axis rescales automatically to whatever lines are actually
   *  rendered, so hiding a line here is enough to shrink/grow the axis. */
  visibleKeys?: Set<string>;
  /** Label for the `net_worth` line -- callers swap this to "Net Combined"
   *  when the field holds a partial sum instead of the true net worth. */
  totalLabel?: string;
}) {
  const suppressMouseUntilRef = useRef(0);
  // Tracks hover/scrub state ourselves rather than trusting recharts' own
  // active-tooltip state: recharts never clears that state on touchend (only
  // on a real mouseleave), so its activeDot/cursor rendering would otherwise
  // stay frozen at the last touched point after the finger lifts.
  const [isScrubbing, setIsScrubbing] = useState(false);

  const handleScrub = useCallback(
    (point: NetWorthByClassPoint | null) => {
      if (Date.now() < suppressMouseUntilRef.current) return;
      setIsScrubbing(point !== null);
      onScrub?.(point);
    },
    [onScrub]
  );

  const handleReleased = useCallback(() => {
    setIsScrubbing(false);
    onScrub?.(null);
  }, [onScrub]);

  const handleTouchEnded = useCallback(() => {
    suppressMouseUntilRef.current = Date.now() + TOUCH_MOUSE_SUPPRESS_MS;
    setIsScrubbing(false);
    onScrub?.(null);
  }, [onScrub]);

  // History is often monthly-granularity in the past and daily going
  // forward -- a plain category axis would space every point evenly
  // regardless of the actual gap between dates, squeezing years of monthly
  // snapshots into the same width as a few weeks of daily ones. Using a
  // numeric time scale keyed off each point's real timestamp makes the x
  // axis honor actual elapsed time.
  const timedPoints = useMemo(
    () => points.map((p) => ({ ...p, _ts: new Date(`${p.date}T00:00:00Z`).getTime() })),
    [points]
  );

  if (points.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-zinc-500">
        Not enough history yet — check back after a few days of syncing.
      </div>
    );
  }

  const activeClasses = NET_WORTH_DISPLAY_CLASSES.filter(
    (cls) =>
      points.some((p) => Number(p[cls.id] ?? 0) !== 0) && (!visibleKeys || visibleKeys.has(cls.id))
  );
  const showNetWorth = !visibleKeys || visibleKeys.has("net_worth");

  return (
    <div
      onTouchEnd={handleTouchEnded}
      onTouchCancel={handleTouchEnded}
      onPointerUp={handleReleased}
      onPointerLeave={handleReleased}
      className="select-none touch-none [-webkit-touch-callout:none]"
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={timedPoints} margin={{ left: -16, right: 8 }}>
          {onScrub && <ScrubTracker onScrub={handleScrub} />}
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="_ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => formatDate(new Date(t).toISOString().slice(0, 10))}
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
          <Tooltip
            content={() => null}
            cursor={isScrubbing ? { stroke: "var(--chart-axis)", strokeWidth: 1 } : false}
          />
          {showNetWorth && (
            <Line
              type="monotone"
              dataKey="net_worth"
              name={totalLabel}
              stroke="var(--chart-net-worth)"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
              activeDot={isScrubbing ? { r: 4, strokeWidth: 2, fill: "var(--background)" } : false}
            />
          )}
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
              activeDot={isScrubbing ? { r: 3 } : false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
