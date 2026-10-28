"use client";

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
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      const result = await signIn("credentials", {
        ...values,
        redirect: false,
        callbackUrl: "/",
      });

      if (!result?.ok || result.error) {
        setError("root.server", {
          type: "server",
          message: "Anmeldung nicht möglich. Prüfe deine Zugangsdaten oder versuche es später erneut.",
        });
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("root.server", {
        type: "server",
        message: "Die Anmeldung ist gerade nicht erreichbar. Bitte versuche es erneut.",
      });
    }
  });

  return { register, errors, busy: isSubmitting, submit };
}
