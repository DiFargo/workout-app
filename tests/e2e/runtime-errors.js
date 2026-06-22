export function failOnRuntimeErrors(page) {
  const runtimeErrors = [];

  page.on("pageerror", (error) => {
    runtimeErrors.push(error?.stack || error?.message || String(error));
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;

    const text = message.text();
    if (
      text.includes("App runtime error") ||
      text.includes("ReferenceError") ||
      text.includes("is not defined") ||
      text.includes("Cannot access")
    ) {
      runtimeErrors.push(text);
    }
  });

  return () => {
    if (runtimeErrors.length > 0) {
      throw new Error(`Runtime errors detected:\n${runtimeErrors.join("\n\n")}`);
    }
  };
}
