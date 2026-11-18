import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";


export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "block h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
