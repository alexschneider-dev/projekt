"use client";

import {
  useEffect,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/lib/constants/routes";
import { ERROR_PWA } from "@/lib/http/errors/pwa";
import { IosInstallInstructions } from "./ios-install-instructions";


type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaSupport() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [offline, setOffline] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iosInstallAvailable, setIosInstallAvailable] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateInstallation = () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = displayMode.matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIosInstallAvailable(ios && !standalone);
      if (standalone) {
        setInstallPrompt(null);
        setShowInstructions(false);
      }
    };
    const installed = () => {
      setInstallPrompt(null);
      setIosInstallAvailable(false);
      setShowInstructions(false);
    };
    updateConnection();
    updateInstallation();
    displayMode.addEventListener("change", updateInstallation);
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
      displayMode.removeEventListener("change", updateInstallation);
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

  if (!offline && !installPrompt && !iosInstallAvailable && !error) return null;

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
      ) : iosInstallAvailable ? (
        <Button
          onClick={() => setShowInstructions(!showInstructions)}
          aria-expanded={showInstructions}
          aria-controls="ios-install-instructions"
        >
          App installieren
        </Button>
      ) : null}
      {iosInstallAvailable && showInstructions && <IosInstallInstructions />}
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
