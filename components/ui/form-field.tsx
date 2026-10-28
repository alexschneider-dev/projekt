import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


type FormFieldProps = ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string | undefined;
};

export function FormField({
  id,
  label,
  className,
  error,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const description = [describedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div>
      <Label htmlFor={id}>
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={error ? true : invalid}
        aria-describedby={description}
        className={cn("mt-2", className)}
        {...props}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
