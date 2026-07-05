"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PrefetchRoute({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(href);
  }, [router, href]);

  return null;
}
