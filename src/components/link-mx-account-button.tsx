"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectWidget, type Event as MxEvent } from "@mxenabled/web-connect-widget-sdk";

const CONTAINER_ID = "mx-connect-widget-container";

export function LinkMxAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<{ unmount: () => void } | null>(null);

  const closeWidget = useCallback(() => {
    widgetRef.current?.unmount();
    widgetRef.current = null;
    setOpen(false);
  }, []);

  const handleEvent = useCallback(
    async (event: MxEvent) => {
      if (event.type === "mx/connect/memberConnected") {
        const memberGuid = event.metadata.member_guid as string | undefined;
        if (!memberGuid) return;
        setConnecting(true);
        try {
          await fetch("/api/mx/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberGuid }),
          });
          closeWidget();
          router.refresh();
        } catch {
          setError("Connected, but syncing failed. Try syncing again shortly.");
        } finally {
          setConnecting(false);
        }
      } else if (event.type === "mx/connect/connected/primaryAction") {
        closeWidget();
        router.refresh();
      } else if (event.type === "mx/connect/memberError") {
        setError("Something went wrong connecting that account.");
      }
    },
    [closeWidget, router]
  );

  async function startConnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mx/widget-url", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Couldn't start MX connection.");
        return;
      }
      setOpen(true);
      setTimeout(() => {
        const widget = ConnectWidget({
          containerSelector: `#${CONTAINER_ID}`,
          url: data.url!,
          onEvent: handleEvent,
        });
        widget.mount();
        widgetRef.current = widget;
      }, 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={startConnect}
        disabled={loading}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {loading ? "Loading..." : "Link brokerage / bank (MX)"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[640px] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {connecting ? "Connecting..." : "Connect an account"}
              </span>
              <button
                onClick={closeWidget}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                Close
              </button>
            </div>
            <div id={CONTAINER_ID} className="flex-1 overflow-hidden" />
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  );
}
