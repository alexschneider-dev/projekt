"use client";

import {
  useEffect,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/lib/constants/routes";
import { ERROR_PWA } from "@/lib/http/errors/pwa";


type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaSupport() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [offline, setOffline] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const installed = () => setInstallPrompt(null);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", installed);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(ROUTES.serviceWorker, {
        scope: ROUTES.home,
        updateViaCache: "none",
      }).catch(() => {
        console.error(ERROR_PWA.REGISTRATION_FAILED.message);
      });
    }

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    setInstalling(true);
    setError(null);

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      setError(ERROR_PWA.INSTALLATION_FAILED.message);
    } finally {
      setInstallPrompt(null);
      setInstalling(false);
    }
  }

  if (!offline && !installPrompt && !error) return null;

  return (
    <aside
      aria-label="App und Verbindung"
      className="flex flex-wrap items-center justify-center gap-3 border-b border-border bg-muted px-6 py-3"
    >
      {offline ? (
        <>
          <Text
            variant="meta"
            role="status"
          >
            Du bist offline. Für die Anmeldung und deine Daten benötigst du eine Internetverbindung.
          </Text>
          <Button onClick={() => window.location.reload()}>
            Erneut versuchen
          </Button>
        </>
      ) : installPrompt ? (
        <Button
          onClick={install}
          disabled={installing}
        >
          App installieren
        </Button>
      ) : null}
      {error && (
        <Text
          variant="error"
          role="alert"
        >
          {error}
        </Text>
      )}
    </aside>
  );
}
