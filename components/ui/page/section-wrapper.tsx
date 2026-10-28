import type { ComponentPropsWithoutRef } from "react";
import BodyWrapper from "./body-wrapper";

type SectionWrapperProps = ComponentPropsWithoutRef<"section"> & {
  variant?: "section" | "card";
};

export default function SectionWrapper({ variant = "section", ...props }: SectionWrapperProps) {
  return (
    <BodyWrapper
      isSection
      variant={variant}
      {...props}
    />
  );
}
