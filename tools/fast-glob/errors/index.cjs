exports.ERROR_GLOB = {
  INVALID_PATTERN: {
    code: "INVALID_PATTERN",
    message: "Suchmuster müssen nichtleere Zeichenketten sein.",
  },
  UNSUPPORTED_OPTION: {
    code: "UNSUPPORTED_OPTION",
    message: (key) => `Nicht unterstützte fast-glob-Option: ${key}`,
  },
};
