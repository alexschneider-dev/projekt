"use client";

import { useId } from "react";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";


export function JobsFilter({
  isMarkiert,
  onChange,
}: {
  isMarkiert: boolean | undefined;
  onChange: (value?: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="w-full space-y-2 sm:max-w-xs">
      <Label htmlFor={id}>Markierung</Label>
      <Select
        id={id}
        value={isMarkiert === undefined ? "all" : String(isMarkiert)}
        onChange={(event) => onChange(event.target.value === "all" ? undefined : event.target.value === "true")}
      >
        <option value="all">Alle Stellen</option>
        <option value="false">Nicht markiert</option>
        <option value="true">Markiert</option>
      </Select>
    </div>
  );
}
