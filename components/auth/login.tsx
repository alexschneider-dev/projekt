import { Text } from "@/components/ui/text";
import SectionWrapper from "@/components/ui/page/section-wrapper";
import PageWrapper from "@/components/ui/page/page-wrapper";
import { AppLink } from "@/components/ui/app-link";
import { ROUTES } from "@/lib/constants/routes";
import { LoginForm } from "./login-form";


export function Login() {
  return (
    <PageWrapper variant="auth">
      <SectionWrapper variant="card">
        <AppLink
          href={ROUTES.home}
          variant="authBrand"
          aria-label="Projekt – zur Homepage"
        >
          PROJEKT
        </AppLink>

        <h1>Willkommen zurück</h1>

        <Text variant="intro">
          Melde dich mit deinem internen Konto an.
        </Text>

        <LoginForm />
        <Text variant="hint">
          Du benötigst Zugang? Wende dich an deine Administration.
        </Text>
      </SectionWrapper>
    </PageWrapper>
  );
}
