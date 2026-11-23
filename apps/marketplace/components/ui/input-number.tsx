"use client";

import type { ComponentProps } from "react";
import { Input } from "./input";


type InputNumberProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
};

export function InputNumber({
  value,
  onChange,
  min = 0,
  max,
  ...props
}: InputNumberProps) {
  return (
    <Input
      {...props}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value || ""}
      onChange={(event) => {
        const next = Number(event.target.value);
        // Unterhalb des Mindestwerts weitertippen; die endgültige Prüfung übernimmt Zod.
        if (Number.isInteger(next) && next >= 0 && next <= max) onChange(next);
      }}
    />
  );
}
