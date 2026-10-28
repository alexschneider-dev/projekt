import type { ComponentPropsWithoutRef } from "react";
import BodyWrapper from "./body-wrapper";

type PageWrapperProps = ComponentPropsWithoutRef<"main"> & {
  variant?: "default" | "centered" | "auth";
};

export default function PageWrapper({ variant = "default", ...props }: PageWrapperProps) {
  return (
    <BodyWrapper
      isMain
      variant={variant}
      {...props}
    />
  );
}
