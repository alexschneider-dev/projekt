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
import { Text } from "@/components/ui/text";
import SectionWrapper from "@/components/ui/page/section-wrapper";
import { useJobCsvForm } from "@/hooks/jobs/use-job-csv-form";


export function JobCsvUpload() {
  const {
    form,
    submit,
    result,
    resetResult,
    busy,
    ready,
  } = useJobCsvForm();
  const serverError = form.formState.errors.root?.server?.message;

  return (
    <SectionWrapper variant="card">
      <h2>Stellen aus CSV markieren</h2>
      <Text variant="intro">
        Eine Spalte mit einem Link pro Zeile, optional mit Kopfzeile URL oder Link.
        Höchstens 2 MB und 10.000 Links. Nur vorhandene Stellen werden markiert.
      </Text>
      <Form {...form}>
        <form
          onSubmit={submit}
          aria-busy={busy}
          noValidate
        >
          <FieldGroup>
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CSV-Datei</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      onChange={(event) => {
                        field.onChange(event.target.files?.[0]);
                        form.clearErrors("root");
                        resetResult();
                      }}
                      disabled={!ready || busy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && <FieldError>{serverError}</FieldError>}
            <Button
              type="submit"
              disabled={!ready || busy}
            >
              {busy ? "Wird abgeglichen …" : "CSV abgleichen und markieren"}
            </Button>
            {result && (
              <Text role="status">
                {result.marked} neu markiert · {result.alreadyMarked} bereits markiert · {result.notFound} nicht gefunden
                {" · "}{result.duplicates} doppelte Links übersprungen
              </Text>
            )}
          </FieldGroup>
        </form>
      </Form>
    </SectionWrapper>
  );
}
