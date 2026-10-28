import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";


const variants = {
  default: "mx-auto w-full max-w-6xl px-6 py-8",
  centered: "flex min-h-screen flex-col items-center justify-center gap-6 p-6",
  auth: "flex min-h-screen items-center justify-center bg-muted/40 px-5 py-12",
  document: "flex min-h-screen flex-col font-sans antialiased",
  section: "w-full",
  card: "w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[0_1px_3px_rgb(0_0_0/0.08)]",
};

type WrapperTag =
  | { isMain: true; isSection?: never }
  | { isMain?: never; isSection: true }
  | { isMain?: false; isSection?: false };

export type BodyWrapperProps = ComponentPropsWithoutRef<"div"> & WrapperTag & {
  variant?: keyof typeof variants;
};

export default function BodyWrapper({
  children,
  className,
  isMain,
  isSection,
  variant,
  ...props
}: BodyWrapperProps) {
  const Tag = isMain ? "main" : isSection ? "section" : "div";
  const layout = variant ?? (isMain ? "default" : isSection ? "section" : undefined);

  return (
    <Tag
      className={cn(layout && variants[layout], className)}
      {...props}
    >
      {children}
    </Tag>
  );
}
