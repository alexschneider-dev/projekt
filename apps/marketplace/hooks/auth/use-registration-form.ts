"use client";

import { z } from "zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registrationSchema,
  resendVerificationSchema,
  type RegistrationValues,
} from "@/lib/schemas/auth/registration.schema";
import { useAppMutation } from "@/lib/query/use-app-mutation";
import { fetchJson } from "@/lib/http/fetch-json";
import { ROUTES } from "@/lib/constants/routes";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_REGISTRATION } from "@/lib/http/errors/registration";


export function useRegistrationForm(resend: boolean) {
  const [
    sent,
    setSent
  ] = useState(false);
  const schema = resend ? resendVerificationSchema.extend({ password: z.string() }) : registrationSchema;
  const form = useForm<RegistrationValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const mutation = useAppMutation({
    mutationFn: (values: Partial<RegistrationValues>) =>
      fetchJson(resend ? ROUTES.resendVerificationApi : ROUTES.registerApi, {
        method: "POST",
        body: values,
      }),
    fn: { showErrorNotification: false },
  });
  const submit = form.handleSubmit(async (values) => {
    setSent(false);
    try {
      await mutation.mutateAsync(values);
      form.reset({
        email: values.email,
        password: "",
      });
      setSent(true);
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof ApiError ? error.message : ERROR_REGISTRATION.FAILED.message,
      });
    }
  });
  return {
    form,
    submit,
    sent,
    busy: form.formState.isSubmitting,
    ready: form.formState.isReady,
  };
}
