"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import {
  dictionaries,
  type Dictionary
} from "@/lib/catalog/dictionaries";
import type { MasterDataOption } from "@/lib/catalog/master-data";
import {
  ROUTES,
  masterDataCreateHref,
  masterDataEditHref
} from "@/lib/constants/routes";
import { fetchJson } from "@/lib/http/fetch-json";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_MASTER_DATA } from "@/lib/http/errors/master-data";
import { DataTable } from "@/components/ui/data-table";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import PageWrapper from "@/components/ui/page/page-wrapper";


export function MasterDataList({ dictionary }: { dictionary: Dictionary }) {
  const config = dictionaries[dictionary];
  const query = useQuery({
    queryKey: [
      "master-data",
      dictionary
    ],
    queryFn: ({ signal }) => fetchJson<MasterDataOption[]>(
      `${config.api}?categoryId=chairs&includeInactive=true`,
      { signal },
    ),
  });
  const columns = useMemo<ColumnDef<MasterDataOption>[]>(() => [
    {
      header: "Bezeichnung",
      accessorKey: "label",
      cell: ({ row }) => (
        <AppLink href={masterDataEditHref(config.href, row.original.id)}>
          {row.original.label}
        </AppLink>
      ),
    },
    {
      header: "Status",
      accessorKey: "active",
      cell: ({ row }) => row.original.active ? "Aktiv" : "Deaktiviert",
    },
  ], [config.href]);

  return (
    <PageWrapper>
      <AppLink href={ROUTES.superAdmin}>Zur Verwaltung</AppLink>
      <div className="my-6 flex flex-wrap items-center justify-between gap-4">
        <h1>{config.label}</h1>
        <AppLink
          href={masterDataCreateHref(config.href)}
          variant="button"
        >
          <Plus
            size={18}
            aria-hidden="true"
          />
          {config.singular} anlegen
        </AppLink>
      </div>
      <Text variant="description">
        Gemeinsame Auswahl für Stühle. Wähle einen Eintrag zum Bearbeiten aus.
      </Text>
      {query.isPending && <Text role="status">Einträge werden geladen …</Text>}
      {query.isError && (
        <div className="space-y-4">
          <FieldError>{query.error instanceof ApiError ? query.error.message : ERROR_MASTER_DATA.LOAD.message}</FieldError>
          <Button onClick={() => query.refetch()}>Erneut laden</Button>
        </div>
      )}
      {query.isSuccess && (
        <>
          <DataTable
            data={query.data}
            columns={columns}
            caption={config.label}
            rowHref={(option) => masterDataEditHref(config.href, option.id)}
          />
          {!query.data.length && <Text variant="hint">Noch keine Einträge vorhanden.</Text>}
        </>
      )}
    </PageWrapper>
  );
}
