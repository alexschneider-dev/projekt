import type { ComponentProps } from "react";


export function Select(props: ComponentProps<"select">) {
  return <select
    className="h-11 w-full rounded-lg border bg-white px-3 text-sm"
    {...props}
  />;
}
