import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";


const variants = {
  text: "text-primary underline underline-offset-4",
  navigation: "underline underline-offset-4",
  brand: "font-semibold",
  authBrand: "mb-8 inline-block text-sm font-semibold tracking-wide text-primary",
};

type AppLinkProps = ComponentProps<typeof Link> & {
  variant?: keyof typeof variants;
};

export function AppLink({
  className,
  variant = "text",
  ...props
}: AppLinkProps) {
  return (
    <Link
      className={cn(
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
