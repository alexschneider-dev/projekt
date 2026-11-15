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


export function JobSearchForm() {
  const {
    form,
    submit,
    message,
    busy,
  } = useJobSearchForm();
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
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Neue Such-URL</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="url"
                    autoComplete="off"
                    required
                    maxLength={4096}
                    disabled={busy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serverError && <FieldError>{serverError}</FieldError>}
          <Button
            type="submit"
            disabled={busy}
          >
            {busy ? "Wird gespeichert …" : "Such-URL hinzufügen"}
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
