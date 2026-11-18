"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useLoginForm } from "@/hooks/auth/use-login-form";


export function LoginForm() {
  const {
    form,
    busy,
    submit,
  } = useLoginForm();
  const serverError = form.formState.errors.root?.server?.message;

  return (
    <Form {...form}>
      <form
        onSubmit={submit}
        aria-busy={busy}
        noValidate
      >
        <FieldGroup>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-Mail</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={254}
                    disabled={busy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Passwort</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    disabled={busy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serverError && (
            <FieldError>
              {serverError}
            </FieldError>
          )}
          <Button
            type="submit"
            disabled={busy}
            fullWidth
          >
            {busy ? "Anmeldung läuft …" : "Anmelden"}
          </Button>
        </FieldGroup>
      </form>
    </Form>
  );
}
