"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Logo } from "@/components/logo";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme: string; size: string; width?: number; text?: string }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function LoginPage() {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestSubmitting, setGuestSubmitting] = useState(false);

  async function handleGuestLogin(e: React.FormEvent) {
    e.preventDefault();
    setGuestError(null);
    setGuestSubmitting(true);
    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setGuestError(data.error ?? "Incorrect passcode");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setGuestError("Sign-in failed. Please try again.");
    } finally {
      setGuestSubmitting(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    async function handleCredential(response: { credential: string }) {
      setError(null);
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Sign-in failed");
          return;
        }
        router.push("/");
        router.refresh();
      } catch {
        setError("Sign-in failed. Please try again.");
      }
    }

    function initGoogle() {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID!,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 280,
        text: "continue_with",
      });
      window.google.accounts.id.prompt();
    }

    const interval = setInterval(() => {
      if (window.google) {
        initGoogle();
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <Logo className="mb-3 justify-center" iconSize={40} />
          <p className="mb-6 text-sm text-zinc-500">Sign in to your finances.</p>
          {GOOGLE_CLIENT_ID ? (
            <div className="flex justify-center" ref={buttonRef} />
          ) : (
            <p className="text-sm text-red-600">
              Google sign-in isn&apos;t configured yet (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID).
            </p>
          )}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            or
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <form onSubmit={handleGuestLogin} className="flex flex-col gap-2">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Guest passcode"
              autoComplete="off"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={guestSubmitting || !passcode}
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {guestSubmitting ? "Checking..." : "Continue as guest"}
            </button>
          </form>
          <p className="mt-2 text-xs text-zinc-400">Read-only access for auditing.</p>
          {guestError && <p className="mt-2 text-sm text-red-600">{guestError}</p>}
        </div>
      </div>
    </>
  );
}
