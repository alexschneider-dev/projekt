import SectionWrapper from "@/components/ui/page/section-wrapper";
import PageWrapper from "@/components/ui/page/page-wrapper";
import Link from "next/link";
import { LoginForm } from "./login-form";

export function Login() {
  return (
    <PageWrapper variant="auth">
      <SectionWrapper variant="card">
        <Link
          href="/"
          className="mb-8 inline-block text-sm font-semibold tracking-wide text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4"
          aria-label="Projekt – zur Homepage"
        >
          PROJEKT
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Willkommen zurück</h1>
        <p className="mt-2 mb-8 text-sm text-muted-foreground">Melde dich mit deinem internen Konto an.</p>
        <LoginForm />
        <p className="mt-6 text-sm text-muted-foreground">Du benötigst Zugang? Wende dich an deine Administration.</p>
      </SectionWrapper>
    </PageWrapper>
  );
}
