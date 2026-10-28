import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";


const variants = {
  body: "text-base",
  description: "mt-3 text-muted-foreground",
  intro: "mt-2 mb-8 text-sm text-muted-foreground",
  hint: "mt-6 text-sm text-muted-foreground",
  meta: "text-sm text-muted-foreground",
  error: "text-sm text-destructive",
};

type TextProps = ComponentPropsWithoutRef<"p"> & {
  as?: "p" | "span";
  variant?: keyof typeof variants;
};

export function Text({
  as: Tag = "p",
  variant = "body",
  className,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cn(
        "wrap-anywhere",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
