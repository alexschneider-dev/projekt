"use client";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import PageWrapper from "@/components/ui/page/page-wrapper";
import { ERROR_CATALOG } from "@/lib/http/errors/catalog";


export function ErrorView({ reset }: { reset: () => void }) {
  return (
    <PageWrapper>
      <h1>Bitte versuche es erneut</h1>
      <Text variant="intro">{ERROR_CATALOG.UNAVAILABLE.message}</Text>
      <Button onClick={reset}>Erneut laden</Button>
    </PageWrapper>
  );
}
