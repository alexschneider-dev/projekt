"use client";

import { useJobScheduleForm } from "@/hooks/jobs/use-job-schedule-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";


export function JobScheduleForm({ scheduleTime }: { scheduleTime: string | null }) {
  const {
    form,
    submit,
    message,
    busy,
  } = useJobScheduleForm(scheduleTime);

  return (
    <Form {...form}>
      <form
        onSubmit={submit}
        noValidate
        aria-busy={busy}
      >
        <FieldGroup>
          <FormField
            control={form.control}
            name="scheduleTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tägliche Suchzeit (Europe/Berlin)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    onChange={event => field.onChange(event.target.value || null)}
                    className="w-40 max-w-full"
                    type="time"
                    step={60}
                    disabled={busy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Text variant="meta">
            Ohne Uhrzeit läuft keine automatische Suche. Zum Deaktivieren das Feld leeren und speichern.
            Sommer- und Winterzeit werden berücksichtigt. Manuelle Suchen bleiben möglich.
          </Text>
          {form.formState.errors.root?.server?.message && (
            <FieldError>{form.formState.errors.root.server.message}</FieldError>
          )}
          <Button
            className="self-start"
            type="submit"
            disabled={busy || !form.formState.isReady}
          >
            {busy ? "Wird gespeichert …" : "Suchzeit speichern"}
          </Button>
          {message && <Text role="status">{message}</Text>}
        </FieldGroup>
      </form>
    </Form>
  );
}
