"use client";

import { ROUTES } from "@/lib/constants/routes";
import { ERROR_AUTH } from "@/lib/http/errors/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  loginSchema,
  type LoginFormInput,
  type LoginFormValues,
} from "@/lib/schemas/auth/login.schema";


export function useLoginForm() {
  const router = useRouter();
  const form = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await signIn("credentials", {
        ...values,
        redirect: false,
        callbackUrl: ROUTES.home,
      });

      if (!result?.ok || result.error) {
        form.setError("root.server", {
          type: "server",
          message: ERROR_AUTH.LOGIN_FAILED.message,
        });

        return;
      }

      router.replace(ROUTES.home);
      router.refresh();
    } catch {
      form.setError("root.server", {
        type: "server",
        message: ERROR_AUTH.LOGIN_UNAVAILABLE.message,
      });
    }
  });

  return {
    form,
    busy: form.formState.isSubmitting,
    submit,
  };
}
