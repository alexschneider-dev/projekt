"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { CartProvider } from "@/hooks/cart/use-cart";
import { QueryProvider } from "@/components/ui/query-provider";
import { withBasePath } from "@/lib/constants/base-path";


export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath={withBasePath("/api/auth")}>
      <QueryProvider>
        <CartProvider>{children}</CartProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
