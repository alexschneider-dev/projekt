"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { QueryProvider } from "@/components/ui/query-provider";
import { withBasePath } from "@/lib/constants/base-path";


export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath={withBasePath("/api/auth")}>
      <QueryProvider>{children}</QueryProvider>
    </SessionProvider>
  );
}
