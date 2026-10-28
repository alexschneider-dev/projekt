import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
const variants = {
  primary: "bg-primary text-primary-foreground enabled:hover:brightness-95",
  outline: "border-border bg-transparent enabled:hover:bg-accent",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "outline";
  fullWidth?: boolean;
};

export function Button({
  className,
  variant = "primary",
  fullWidth = false,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-transparent px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
