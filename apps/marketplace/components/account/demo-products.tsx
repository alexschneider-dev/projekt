"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/http/fetch-json";
import { ROUTES } from "@/lib/constants/routes";
import type { createDemoProducts } from "@/lib/catalog/demo-products";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_DEMO_PRODUCTS } from "@/lib/http/errors/demo-products";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { FieldError } from "@/components/ui/field";


export function DemoProducts() {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => fetchJson<Awaited<ReturnType<typeof createDemoProducts>>>(ROUTES.demoProductsApi, { method: "POST" }),
    onSuccess: () => router.refresh()
  });

  return (
    <section className="my-8 space-y-4 rounded-xl border bg-white p-6">
      <h2>Demo-Produkte</h2>
      <Text>
        Jeder Klick fügt weitere 1.000 Stühle ohne Bilder mit Angeboten von zwölf Demo-Verkäufern hinzu.
        Die Eigenschaften stammen aus deinen aktiven Stammdaten. Vorhandene Demo-Produkte bleiben erhalten.
      </Text>
      <Button
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Produkte werden angelegt …" : "Weitere 1.000 Demo-Produkte hinzufügen"}
      </Button>
      {mutation.data && (
        <Text role="status">{mutation.data.created.toLocaleString("de-DE")} weitere Produkte angelegt.</Text>
      )}
      {mutation.isError && (
        <FieldError>{mutation.error instanceof ApiError ? mutation.error.message : ERROR_DEMO_PRODUCTS.SAVE.message}</FieldError>
      )}
    </section>
  );
}
