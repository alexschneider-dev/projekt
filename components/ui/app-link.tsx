import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";


const variants = {
  text: "text-primary underline underline-offset-4",
  navigation: "underline underline-offset-4",
  brand: "font-semibold",
  authBrand: "mb-8 inline-block text-sm font-semibold tracking-wide text-primary",
};

type AppLinkProps = {
  variant?: keyof typeof variants;
} & (
  | (ComponentProps<typeof Link> & { navigationMode?: "client" })
  | (ComponentProps<"a"> & { navigationMode: "document" })
);

export function AppLink({
  className,
  variant = "text",
  ...props
}: AppLinkProps) {
  const linkClassName = cn(
    "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4",
    variants[variant],
    className
  );

  if (props.navigationMode === "document") {
    const {
      navigationMode,
      ...anchorProps
    } = props;

    return (
      <a
        data-navigation-mode={navigationMode}
        className={linkClassName}
        {...anchorProps}
      />
    );
  }

  const {
    navigationMode,
    ...linkProps
  } = props;

  return (
    <Link
      data-navigation-mode={navigationMode}
      className={linkClassName}
      {...linkProps}
    />
  );
}
