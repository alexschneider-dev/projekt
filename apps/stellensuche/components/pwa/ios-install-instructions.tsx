import { Text } from "@/components/ui/text";


export function IosInstallInstructions() {
  return (
    <section
      id="ios-install-instructions"
      aria-label="Installation auf iPhone und iPad"
      className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-background p-4"
    >
      <h2>Auf dem Home-Bildschirm hinzufügen</h2>
      <Text variant="meta">
        Auf iPhone und iPad erfolgt die Installation über das Browsermenü:
      </Text>
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        <li>
          <Text variant="meta">
            Tippe im Browser auf „Teilen“ (Quadrat mit Pfeil nach oben). Je nach Ansicht findest du es im Menü „…“.
          </Text>
        </li>
        <li>
          <Text variant="meta">
            Scrolle im Teilen-Menü nach unten und wähle „Zum Home-Bildschirm“.
          </Text>
        </li>
        <li>
          <Text variant="meta">
            Falls angezeigt, aktiviere „Als Web-App öffnen“. Tippe anschließend auf „Hinzufügen“.
          </Text>
        </li>
      </ol>
      <Text variant="meta">
        Danach startest du Projekt über das neue Symbol. Falls „Zum Home-Bildschirm“ fehlt, öffne diese Website in Safari.
      </Text>
    </section>
  );
}
