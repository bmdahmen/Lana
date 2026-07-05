import clsx from "clsx";

/** Lana's mark: the same wallet glyph used for the favicon/app icon (see
 *  src/app/icon.svg), reused inline so the brand shows up in-app too. Kept on
 *  a fixed white chip since the app is dark-only (see globals.css) and the
 *  mark's black wallet body would otherwise disappear against it. */
export function Logo({
  className,
  iconSize = 28,
  showWordmark = true,
}: {
  className?: string;
  iconSize?: number;
  showWordmark?: boolean;
}) {
  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <span
        className="flex shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm"
        style={{ width: iconSize, height: iconSize }}
      >
        <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
          <rect x="18" y="14" width="48" height="38" rx="4" fill="#fff" stroke="#000" strokeWidth="3" transform="rotate(-8 42 33)" />
          <rect x="34" y="10" width="48" height="38" rx="4" fill="#fff" stroke="#000" strokeWidth="3" transform="rotate(6 58 29)" />
          <rect x="10" y="40" width="80" height="50" rx="12" fill="#000" />
          <circle cx="68" cy="65" r="6" fill="#fff" />
        </svg>
      </span>
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Lana
        </span>
      )}
    </div>
  );
}
