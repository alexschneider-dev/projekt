import PageWrapper from "@/components/ui/page/page-wrapper";
import Link from "next/link";


export function Home() {
  return (
    <PageWrapper variant="centered">
      <h1 className="text-3xl font-semibold">Projekt</h1>
      <nav
        aria-label="Seitennavigation"
        className="flex flex-wrap justify-center gap-6"
      >
        <Link
          href="/login"
          className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4"
        >
          Anmelden
        </Link>
        <Link
          href="/dashboard"
          className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4"
        >
          Interner Bereich
        </Link>
      </nav>
    </PageWrapper>
  );
}
