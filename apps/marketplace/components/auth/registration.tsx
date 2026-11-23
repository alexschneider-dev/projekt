"use client";

import { useState } from "react";
import { QueryProvider } from "@/components/ui/query-provider";
import PageWrapper from "@/components/ui/page/page-wrapper";
import SectionWrapper from "@/components/ui/page/section-wrapper";
import { Text } from "@/components/ui/text";
import { AppLink } from "@/components/ui/app-link";
import { Navigation } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldError,
  FieldGroup
} from "@/components/ui/field";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from "@/components/ui/form";
import { ROUTES } from "@/lib/constants/routes";
import { useRegistrationForm } from "@/hooks/auth/use-registration-form";


function RegistrationForm({ resend }: { resend: boolean }) {
  const {
    form,
    submit,
    sent,
    busy,
    ready
  } = useRegistrationForm(resend);
  return (
    <Form {...form}>
      <form
        onSubmit={submit}
        noValidate
        aria-busy={busy}
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
                    autoComplete="email"
                    maxLength={254}
                    required
                    disabled={busy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {!resend && (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passwort (12 bis 128 Zeichen)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                      disabled={busy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {form.formState.errors.root?.server?.message && (
            <FieldError>{form.formState.errors.root.server.message}</FieldError>
          )}
          {sent && (
            <Text role="status">
              Falls die Adresse für eine Registrierung infrage kommt, erhältst du einen Bestätigungslink. Prüfe auch
              deinen Spamordner. Der Link gilt 24 Stunden. Bei abgelaufener Registrierung registriere dich bitte erneut.
            </Text>
          )}
          <Button
            type="submit"
            fullWidth
            disabled={busy || !ready}
          >
            {busy ? "Wird gesendet …" : resend ? "Bestätigungslink erneut senden" : "Registrieren"}
          </Button>
        </FieldGroup>
      </form>
    </Form>
  );
}

function RegistrationContent() {
  const [
    resend,
    setResend
  ] = useState(false);
  return (
    <PageWrapper variant="auth">
      <SectionWrapper variant="card">
        <h1>{resend ? "E-Mail bestätigen" : "Konto erstellen"}</h1>
        <Text variant="intro">
          Bestätige deine E-Mail-Adresse, bevor du dich anmeldest. Du erhältst ein Kundenkonto für den Marktplatz.
        </Text>
        <RegistrationForm
          key={String(resend)}
          resend={resend}
        />
        <Navigation
          variant="auth"
          aria-label="Registrierung und Anmeldung"
        >
          <Button
            variant="outline"
            onClick={() => setResend(!resend)}
          >
            {resend ? "Zur Registrierung" : "Keine Bestätigungs-E-Mail erhalten?"}
          </Button>
          <AppLink href={ROUTES.login}>Zur Anmeldung</AppLink>
        </Navigation>
      </SectionWrapper>
    </PageWrapper>
  );
}

export function Registration() {
  return (
    <QueryProvider>
      <RegistrationContent />
    </QueryProvider>
  );
}
