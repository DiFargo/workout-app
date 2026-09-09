import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("client loading state reaches the terminal route instead of exposing empty data", async () => {
  const source = await readFile(new URL("../src/AppCore.jsx", import.meta.url), "utf8");
  const terminalProps = source.slice(source.indexOf("return renderAppTerminalRoute({"));
  assert.match(terminalProps, /\badminClientLoading,/);
  for (const route of ["TrainerClientsWorkspaceRoute", "TrainerDashboardWorkspaceRoute"]) {
    const routeSource = await readFile(new URL(`../src/features/trainer/${route}.jsx`, import.meta.url), "utf8");
    assert.match(routeSource, /clientLoading=\{adminClientLoading\}/);
  }
});
