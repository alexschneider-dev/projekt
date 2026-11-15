"use client";

import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { toastManager } from "@/lib/notifications/toast-manager";
import { cn } from "@/lib/utils";


function ToastMessages() {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      <Toast.Viewport
        aria-label="Benachrichtigungen"
        className="fixed top-4 right-4 left-4 z-100 flex flex-col gap-3 sm:left-auto sm:w-96"
      >
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "flex items-start gap-3 rounded-lg border bg-background p-4 shadow-lg data-limited:hidden",
              toast.type === "error" && "border-destructive"
            )}
          >
            <Toast.Content className="min-w-0 flex-1">
              <Toast.Title render={<Text />} />
            </Toast.Content>
            <Toast.Close render={
              <Button
                variant="outline"
                aria-label="Meldung schließen"
              />
            }>
              <X
                aria-hidden="true"
                className="size-4"
              />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export function Toaster() {
  return (
    <Toast.Provider
      toastManager={toastManager}
      limit={1}
    >
      <ToastMessages />
    </Toast.Provider>
  );
}
