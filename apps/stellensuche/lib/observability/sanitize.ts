// Vor dem Browser-Versand URLs, Identitäten und sensible Felder entfernen.
export function sanitizeTelemetry(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map(item => sanitizeTelemetry(item, key));

  if (value && typeof value === "object") {
    const attribute = value as {
      key?: unknown;
      value?: unknown;
    };

    if (typeof attribute.key === "string" && /url|target|statement|query|cookie|authorization/i.test(attribute.key)) {
      return {
        key: attribute.key,
        value: { stringValue: "<entfernt>" },
      };
    }

    return Object.fromEntries(Object.entries(value)
      .filter(([name]) => !/^(user|cookie|authorization|requestBody|responseBody)$/i.test(name))
      .map(([
        name,
        item,
      ]) => [
          name,
          sanitizeTelemetry(item, name),
        ]));
  }

  if (typeof value !== "string") return value;
  if (/url|href|referrer|filename/i.test(key)) return "<entfernt>";

  return value.replace(/https?:\/\/[^\s)]+/g, "<entfernte-url>").replace(
    /([?&](?:token|key|code|secret|password)=)[^\s&#]+/gi,
    "$1<entfernt>"
  );
}
