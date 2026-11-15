"use client";

import { toastManager } from "@/lib/notifications/toast-manager";
import { ERROR_API } from "@/lib/http/errors/common";


export function useErrorNotification() {
  return (message?: string) => {
    toastManager.add({
      title: message ?? ERROR_API.INTERNAL_SERVER_ERROR.message,
      type: "error",
      priority: "high",
    });
  };
}

export function useSuccessNotification() {
  return () => {
    toastManager.add({
      title: "Erfolgreich.",
      type: "success",
    });
  };
}
