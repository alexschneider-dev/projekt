"use client";

import {
  useEffect,
  useRef
} from "react";
import { QueryProvider } from "@/components/ui/query-provider";
import PageWrapper from "@/components/ui/page/page-wrapper";
import SectionWrapper from "@/components/ui/page/section-wrapper";
import { Text } from "@/components/ui/text";
import { AppLink } from "@/components/ui/app-link";
import { Navigation } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  FieldGroup
} from "@/components/ui/field";
import { withBasePath } from "@/lib/constants/base-path";
import { ROUTES } from "@/lib/constants/routes";
import { fetchJson } from "@/lib/http/fetch-json";
import { useAppMutation } from "@/lib/query/use-app-mutation";
import { ERROR_REGISTRATION } from "@/lib/http/errors/registration";


function VerifyEmailContent() {
  const token = useRef("");
  useEffect(() => {
    if (window.location.hash) {
      token.current = window.location.hash.slice(1);
      window.history.replaceState(null, "", withBasePath(ROUTES.verifyEmail));
    }
  }, []);
  const mutation = useAppMutation({
    mutationFn: () =>
      fetchJson(ROUTES.verifyEmailApi, {
        method: "POST",
        body: { token: token.current },
      }),
    fn: { showErrorNotification: false },
  });
  return (
    <PageWrapper variant="auth">
      <SectionWrapper variant="card">
        <h1>E-Mail-Adresse bestätigen</h1>
        {mutation.isSuccess ? (
          <Text
            variant="description"
            role="status"
          >
            Dein Konto wurde bestätigt. Du kannst dich jetzt anmelden.
          </Text>
        ) : (
          <>
            <Text variant="intro">Bestätige die Registrierung mit dem folgenden Button.</Text>
            <FieldGroup>
              {mutation.isError && (
                <FieldError>{mutation.error.message || ERROR_REGISTRATION.FAILED.message}</FieldError>
              )}
              <Button
                fullWidth
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(undefined)}
              >
                {mutation.isPending ? "Wird bestätigt …" : "E-Mail bestätigen"}
              </Button>
            </FieldGroup>
          </>
        )}
        <Navigation
          variant="auth"
          aria-label="Registrierung und Anmeldung"
        >
          {!mutation.isSuccess && <AppLink href={ROUTES.register}>Neuen Bestätigungslink anfordern</AppLink>}
          <AppLink href={ROUTES.login}>Zur Anmeldung</AppLink>
        </Navigation>
      </SectionWrapper>
    </PageWrapper>
  );
}

export function VerifyEmail() {
  return (
    <QueryProvider>
      <VerifyEmailContent />
    </QueryProvider>
  );
}
