import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";


const variants = {
  button: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-95",
  card: "block rounded-xl",
  text: "text-primary underline underline-offset-4",
  navigation: "inline-flex items-center gap-2 text-sm font-medium hover:text-primary",
  brand: "inline-flex items-center gap-2 text-2xl font-semibold tracking-tight",
  authBrand: "mb-8 inline-block text-sm font-semibold tracking-wide text-primary",
  pagination:
    "inline-flex size-9 items-center justify-center rounded-lg text-sm hover:bg-accent aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground sm:size-11",
};

type AppLinkProps = {
  variant?: keyof typeof variants;
} & (
    (ComponentProps<typeof Link> & { navigationMode?: "client" }) | (ComponentProps<"a"> & { navigationMode: "document" })
  );

export function AppLink({
  className,
  variant = "text",
  ...props
}: AppLinkProps) {
  const linkClassName = cn(
    "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4",
    variants[variant],
    className,
  );

  if (props.navigationMode === "document") {
    const {
      navigationMode,
      ...anchorProps
    } = props;

    return <a
      data-navigation-mode={navigationMode}
      className={linkClassName}
      {...anchorProps}
    />;
  }

  const {
    navigationMode,
    ...linkProps
  } = props;

  return <Link
    data-navigation-mode={navigationMode}
    className={linkClassName}
    {...linkProps}
  />;
}
