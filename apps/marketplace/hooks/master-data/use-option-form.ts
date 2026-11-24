import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  dictionaries,
  type Dictionary
} from "@/lib/catalog/dictionaries";
import type { MasterDataOption } from "@/lib/catalog/master-data";
import { masterDataEditHref } from "@/lib/constants/routes";
import {
  optionBodySchema,
  type OptionInput
} from "@/lib/schemas/master-data";
import { fetchJson } from "@/lib/http/fetch-json";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_MASTER_DATA } from "@/lib/http/errors/master-data";


export function useOptionForm(dictionary: Dictionary, option?: MasterDataOption) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [
    saved,
    setSaved
  ] = useState(false);
  const form = useForm<OptionInput>({
    resolver: zodResolver(optionBodySchema),
    defaultValues: {
      label: option?.label ?? "",
      active: option?.active ?? true
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setSaved(false);
    form.clearErrors("root");

    try {
      const config = dictionaries[dictionary];
      const result = await fetchJson<MasterDataOption>(
        option ? `${config.api}/${encodeURIComponent(option.id)}` : `${config.api}?categoryId=chairs`,
        {
          method: option ? "PATCH" : "POST",
          body: values
        },
      );
      queryClient.setQueryData([
        "master-data-entry",
        dictionary,
        result.id
      ], result);
      await queryClient.invalidateQueries({
        queryKey: [
          "master-data",
          dictionary
        ]
      });
      await queryClient.invalidateQueries({ queryKey: ["products"] });

      form.reset({
        label: result.label,
        active: result.active
      });
      setSaved(true);
      if (!option) router.replace(masterDataEditHref(config.href, result.id));
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof ApiError ? error.message : ERROR_MASTER_DATA.SAVE.message,
      });
    }
  });

  return {
    form,
    submit,
    saved
  };
}
