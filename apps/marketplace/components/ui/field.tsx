import type { ComponentProps } from "react";


export function FieldGroup(props: ComponentProps<"div">) {
  return <div
    className="grid gap-5"
    {...props}
  />;
}

export function FieldError(props: ComponentProps<"div">) {
  return <div
    role="alert"
    className="text-sm text-destructive"
    {...props}
  />;
}
