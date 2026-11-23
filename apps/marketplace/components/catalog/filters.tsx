"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputNumber } from "@/components/ui/input-number";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  chairFilters,
  sortLabels
} from "@/lib/catalog/config";
import {
  catalogSchema,
  type CatalogFilters
} from "@/lib/schemas/catalog";


export function Filters({
  values,
  onApply
}: {
  values: CatalogFilters;
  onApply: (value: CatalogFilters) => void
}) {
  const form = useForm<z.input<typeof catalogSchema>, unknown, CatalogFilters>({
    resolver: zodResolver(catalogSchema),
    defaultValues: values,
  });
  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit((value) =>
          onApply({
            ...value,
            page: 1,
          }),
        )}
        noValidate
      >
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Suche</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Welcher Stuhl passt zu dir?"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {Object.entries(chairFilters).map(([
          key,
          config
        ]) => (
          <FormField
            key={key}
            control={form.control}
            name={key as "material" | "color" | "kind"}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{config.label}</FormLabel>
                <FormControl>
                  <Select {...field}>
                    <option value="">Alle</option>
                    {config.values.map((value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {value}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-sm font-medium">Preis in Euro</legend>
          {([
            "min",
            "max"
          ] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{name === "min" ? "Von" : "Bis"}</FormLabel>
                  <FormControl>
                    <InputNumber
                      {...field}
                      value={Number(field.value) || 0}
                      max={100000}
                      placeholder={name === "max" ? "Unbegrenzt" : "0"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </fieldset>
        <FormField
          control={form.control}
          name="sort"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sortierung</FormLabel>
              <FormControl>
                <Select {...field}>
                  {Object.entries(sortLabels).map(([
                    key,
                    label
                  ]) => (
                    <option
                      key={key}
                      value={key}
                    >
                      {label}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          fullWidth
        >
          Produkte anzeigen
        </Button>
        <Button
          variant="outline"
          fullWidth
          onClick={() => {
            const defaults = catalogSchema.parse({});
            form.reset(defaults);
            onApply(defaults);
          }}
        >
          Filter zurücksetzen
        </Button>
      </form>
    </Form>
  );
}
