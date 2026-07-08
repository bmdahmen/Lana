"use client";

import { useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

const ACTION_WIDTH = 136;
const HALF_ACTION_WIDTH = ACTION_WIDTH / 2;
const DRAG_THRESHOLD = 6;

/**
 * A row that can be swiped left (mouse drag or touch) to reveal Edit/Delete
 * actions, iOS-Mail-style -- a plain tap (no meaningful horizontal movement)
 * falls through to `onTap` instead, so existing tap-to-open/tap-to-expand
 * behavior on these rows keeps working untouched.
 */
export function SwipeableRow({
  children,
  onTap,
  onEdit,
  onDelete,
  className,
}: {
  children: ReactNode;
  onTap: () => void;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const moved = useRef(false);
  const activePointerId = useRef<number | null>(null);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startOffset.current = offset;
    moved.current = false;
    activePointerId.current = e.pointerId;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > DRAG_THRESHOLD) moved.current = true;
    setOffset(Math.min(0, Math.max(-ACTION_WIDTH, startOffset.current + delta)));
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setDragging(false);

    if (!moved.current) {
      if (offset === 0) onTap();
      else setOffset(0);
      return;
    }
    setOffset((current) => (current < -HALF_ACTION_WIDTH ? -ACTION_WIDTH : 0));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap();
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_WIDTH }}>
        <button
          type="button"
          onClick={() => {
            setOffset(0);
            onEdit();
          }}
          style={{ width: HALF_ACTION_WIDTH }}
          className="flex items-center justify-center bg-blue-600 text-sm font-medium text-white active:bg-blue-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            setOffset(0);
            onDelete();
          }}
          style={{ width: HALF_ACTION_WIDTH }}
          className="flex items-center justify-center bg-red-600 text-sm font-medium text-white active:bg-red-700"
        >
          Delete
        </button>
      </div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: "pan-y",
          transition: dragging ? "none" : "transform 150ms ease-out",
        }}
        className={clsx("relative cursor-pointer text-left", className)}
      >
        {children}
      </div>
    </div>
  );
}
