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
import { useJobSearchForm } from "@/hooks/jobs/use-job-search-form";
import type { JobSearchesResult } from "@/lib/types/jobs";


export function JobSearchForm({ search }: { search?: JobSearchesResult[number] }) {
  const {
    form,
    submit,
    message,
    ready,
    busy,
  } = useJobSearchForm(search);
  const serverError = form.formState.errors.root?.server?.message;

  return (
    <Form {...form}>
      <form
        onSubmit={submit}
        aria-busy={busy}
        noValidate
      >
        <FieldGroup>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Titel</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    required
                    maxLength={200}
                    disabled={!ready || busy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{search ? "Such-URL" : "Neue Such-URL"}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="url"
                    autoComplete="off"
                    required
                    maxLength={4096}
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
            {busy ? "Wird gespeichert …" : search ? "Änderungen speichern" : "Such-URL hinzufügen"}
          </Button>
          <Text
            role="status"
            variant="meta"
          >
            {message}
          </Text>
        </FieldGroup>
      </form>
    </Form>
  );
}
