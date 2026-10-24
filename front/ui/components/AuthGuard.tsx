"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadOpenboxApiKey } from "@/services/api";

/** Bounces to /login when no credential is stored. Server renders nothing gated. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!loadOpenboxApiKey()) {
      router.replace("/login");
    } else {
      setAllowed(true);
    }
  }, [router]);

  if (!allowed) return null;
  return <>{children}</>;
}
