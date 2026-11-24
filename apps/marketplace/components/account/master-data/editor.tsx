"use client";

import { useQuery } from "@tanstack/react-query";
import {
  dictionaries,
  type Dictionary
} from "@/lib/catalog/dictionaries";
import type { MasterDataOption } from "@/lib/catalog/master-data";
import { fetchJson } from "@/lib/http/fetch-json";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_MASTER_DATA } from "@/lib/http/errors/master-data";
import { useOptionForm } from "@/hooks/master-data/use-option-form";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import PageWrapper from "@/components/ui/page/page-wrapper";
import SectionWrapper from "@/components/ui/page/section-wrapper";


function OptionForm({
  dictionary,
  option
}: {
  dictionary: Dictionary;
  option?: MasterDataOption
}) {
  const {
    form,
    submit,
    saved
  } = useOptionForm(dictionary, option);
  const busy = form.formState.isSubmitting;
  const error = form.formState.errors.root?.server?.message;

  return (
    <SectionWrapper variant="card">
      <Form {...form}>
        <form
          onSubmit={submit}
          className="space-y-6"
          aria-busy={busy}
          noValidate
        >
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bezeichnung</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={80}
                    disabled={busy}
                    autoFocus
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verfügbarkeit</FormLabel>
                <FormControl>
                  <Select
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={String(field.value)}
                    onChange={(event) => field.onChange(event.target.value === "true")}
                    disabled={busy}
                  >
                    <option value="true">Aktiv</option>
                    <option value="false">Deaktiviert</option>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Text variant="hint">
            Deaktivierte Einträge bleiben an bestehenden Produkten erhalten.
          </Text>
          {error && <FieldError>{error}</FieldError>}
          {saved && <Text role="status">Gespeichert.</Text>}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              disabled={busy}
            >
              {busy ? "Wird gespeichert …" : option ? "Speichern" : "Anlegen"}
            </Button>
            <AppLink href={dictionaries[dictionary].href}>Zur Liste</AppLink>
          </div>
        </form>
      </Form>
    </SectionWrapper>
  );
}

export function MasterDataCreate({ dictionary }: { dictionary: Dictionary }) {
  const config = dictionaries[dictionary];

  return (
    <PageWrapper>
      <AppLink href={config.href}>Zur Liste: {config.label}</AppLink>
      <h1 className="my-6">{config.singular} anlegen</h1>
      <OptionForm dictionary={dictionary} />
    </PageWrapper>
  );
}

export function MasterDataEdit({
  dictionary,
  id
}: {
  dictionary: Dictionary;
  id: string
}) {
  const config = dictionaries[dictionary];
  const query = useQuery({
    queryKey: [
      "master-data-entry",
      dictionary,
      id
    ],
    queryFn: ({ signal }) => fetchJson<MasterDataOption>(`${config.api}/${encodeURIComponent(id)}`, { signal }),
    retry: false,
  });

  return (
    <PageWrapper>
      <AppLink href={config.href}>Zur Liste: {config.label}</AppLink>
      <h1 className="my-6">{config.singular} bearbeiten</h1>
      {query.isPending && <Text role="status">Eintrag wird geladen …</Text>}
      {query.isError && (
        <div className="space-y-4">
          <FieldError>{query.error instanceof ApiError ? query.error.message : ERROR_MASTER_DATA.LOAD.message}</FieldError>
          <Button onClick={() => query.refetch()}>Erneut laden</Button>
        </div>
      )}
      {query.data && (
        <OptionForm
          key={query.data.id}
          dictionary={dictionary}
          option={query.data}
        />
      )}
    </PageWrapper>
  );
}
