"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 64;
const MAX_PULL = 96;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

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
      setRefreshing(true);
      setPull(PULL_THRESHOLD);
      fetch("/api/net-worth/recompute", { method: "POST" })
        .catch(() => {})
        .finally(() => {
          setRefreshing(false);
          setPull(0);
          router.refresh();
        });
    } else {
      setPull(0);
    }
  }, [pull, router]);

  useEffect(() => {
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  return (
    <>
      <div
        aria-hidden
        className="flex items-center justify-center overflow-hidden md:hidden"
        style={{ height: pull, transition: dragging ? "none" : "height 150ms ease-out" }}
      >
        <RefreshSpinner active={pull >= PULL_THRESHOLD || refreshing} spinning={refreshing} />
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
      className={
        (spinning ? "animate-spin " : "") +
        (active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600")
      }
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
