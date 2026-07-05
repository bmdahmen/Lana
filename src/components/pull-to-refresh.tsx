"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 64;
const MAX_PULL = 96;
const WHEEL_IDLE_MS = 150;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const wheelPull = useRef(0);
  const wheelIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshing(true);
    setPull(PULL_THRESHOLD);
    fetch("/api/net-worth/recompute", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        setRefreshing(false);
        setPull(0);
        router.refresh();
      });
  }, [router]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    const dragStart = window.scrollY === 0 ? e.touches[0].clientY : null;
    startY.current = dragStart;
    setDragging(dragStart !== null);
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && window.scrollY === 0) {
      setPull(Math.min(delta * 0.4, MAX_PULL));
    } else {
      setPull(0);
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(() => {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);

    if (pull >= PULL_THRESHOLD) {
      triggerRefresh();
    } else {
      setPull(0);
    }
  }, [pull, triggerRefresh]);

  // Desktop/trackpad equivalent of the touch gesture above: scrolling past
  // the top (wheel deltaY < 0) while already at scrollY 0 is the mouse/
  // trackpad version of dragging a finger down from the top on mobile.
  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (refreshing) return;
      if (window.scrollY > 0 || e.deltaY >= 0) {
        wheelPull.current = 0;
        setDragging(false);
        setPull(0);
        return;
      }

      wheelPull.current = Math.min(wheelPull.current + -e.deltaY * 0.4, MAX_PULL);
      setDragging(true);
      setPull(wheelPull.current);

      if (wheelIdleTimer.current) clearTimeout(wheelIdleTimer.current);
      wheelIdleTimer.current = setTimeout(() => {
        setDragging(false);
        if (wheelPull.current >= PULL_THRESHOLD) {
          triggerRefresh();
        } else {
          setPull(0);
        }
        wheelPull.current = 0;
      }, WHEEL_IDLE_MS);
    },
    [refreshing, triggerRefresh]
  );

  useEffect(() => {
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("wheel", onWheel);
      if (wheelIdleTimer.current) clearTimeout(wheelIdleTimer.current);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd, onWheel]);

  return (
    <>
      <div
        aria-hidden
        className="flex items-center justify-center gap-2 overflow-hidden"
        style={{ height: pull, transition: dragging ? "none" : "height 150ms ease-out" }}
      >
        <RefreshSpinner active={pull >= PULL_THRESHOLD || refreshing} spinning={refreshing} />
        {pull > 8 && (
          <span
            className={
              "text-xs font-medium " +
              (pull >= PULL_THRESHOLD || refreshing ? "text-zinc-50" : "text-zinc-500")
            }
          >
            {refreshing ? "Syncing…" : pull >= PULL_THRESHOLD ? "Release to sync" : "Pull to sync"}
          </span>
        )}
      </div>
      {children}
    </>
  );
}

function RefreshSpinner({ active, spinning }: { active: boolean; spinning: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={(spinning ? "animate-spin " : "") + (active ? "text-zinc-50" : "text-zinc-500")}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
