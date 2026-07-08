"use client";

import { useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

const ACTION_WIDTH = 136;
const HALF_ACTION_WIDTH = ACTION_WIDTH / 2;
const DRAG_THRESHOLD = 6;

/**
 * A row that can be swiped left (mouse drag or touch) to reveal Edit/Delete
 * icon buttons underneath, iOS-Mail-style. The sliding content wrapper MUST
 * have a fully opaque background (not a `/NN` translucency class) -- a
 * translucent background here previously let the action buttons bleed
 * through even at rest, which is why this looked broken on a real device
 * the first time around.
 */
export function SwipeableRow({
  children,
  onEdit,
  onDelete,
  className,
}: {
  children: ReactNode;
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
    setOffset((current) => (current < -HALF_ACTION_WIDTH ? -ACTION_WIDTH : 0));
  }

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-3 bg-zinc-100 dark:bg-zinc-900"
        style={{ width: ACTION_WIDTH }}
      >
        <button
          type="button"
          onClick={() => {
            setOffset(0);
            onEdit();
          }}
          aria-label="Edit"
          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <EditIcon />
        </button>
        <button
          type="button"
          onClick={() => {
            setOffset(0);
            onDelete();
          }}
          aria-label="Delete"
          className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40"
        >
          <DeleteIcon />
        </button>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: "pan-y",
          transition: dragging ? "none" : "transform 150ms ease-out",
        }}
        className={clsx("relative", className)}
      >
        {children}
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
