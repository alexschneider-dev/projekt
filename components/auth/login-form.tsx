"use client";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useLoginForm } from "@/hooks/auth/use-login-form";


export function LoginForm() {
  const { register, errors, busy, submit } = useLoginForm();
  const serverError = errors.root?.server?.message;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5"
      aria-busy={busy}
      noValidate
    >
      <FormField
        id="email"
        label="E-Mail"
        error={errors.email?.message}
        {...register("email")}
        type="email"
        autoComplete="username"
        required
        maxLength={254}
        disabled={busy}
      />
      <FormField
        id="password"
        label="Passwort"
        error={errors.password?.message}
        {...register("password")}
        type="password"
        autoComplete="current-password"
        required
        maxLength={128}
        disabled={busy}
      />
      {serverError && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {serverError}
        </p>
      )}
      <Button
        type="submit"
        disabled={busy}
        fullWidth
      >
        {busy ? "Anmeldung läuft …" : "Anmelden"}
      </Button>
    </form>
  );
}
