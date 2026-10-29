import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";


const variants = {
  centered: "justify-center gap-6",
  dashboard: "mb-10 gap-5 text-sm",
};

type NavigationProps = ComponentProps<"nav"> & {
  variant?: keyof typeof variants;
  "aria-label": string;
};

export function Navigation({
  className,
  variant = "centered",
  ...props
}: NavigationProps) {
  return (
    <nav
      className={cn("flex flex-wrap", variants[variant], className)}
      {...props}
    />
  );
}
