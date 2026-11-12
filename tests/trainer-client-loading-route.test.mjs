import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("client loading state reaches the terminal route instead of exposing empty data", async () => {
  const source = await readFile(new URL("../src/AppCore.jsx", import.meta.url), "utf8");
  const terminalRouteStart = source.lastIndexOf("renderAppTerminalRoute({");
  assert.notEqual(terminalRouteStart, -1, "Terminal route renderer must remain mounted");
  const terminalProps = source.slice(terminalRouteStart);
  assert.match(terminalProps, /\badminClientLoading,/);
  for (const route of ["TrainerClientsWorkspaceRoute", "TrainerDashboardWorkspaceRoute"]) {
    const routeSource = await readFile(new URL(`../src/features/trainer/${route}.jsx`, import.meta.url), "utf8");
    assert.match(routeSource, /clientLoading=\{adminClientLoading\}/);
  }
});
