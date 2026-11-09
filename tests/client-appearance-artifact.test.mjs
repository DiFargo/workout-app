import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertClientAppearanceArtifact } from "../scripts/assert-client-appearance-artifact.mjs";

test("release rejects an artifact whose client theme was tree-shaken", async t => {
  const directory = await mkdtemp(join(tmpdir(), "client-appearance-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "assets"));
  await writeFile(join(directory, "assets", "app.css"), "body{color:black}");
  await assert.rejects(assertClientAppearanceArtifact(directory), /missing from the built artifact/);
  await writeFile(join(directory, "assets", "appearance.css"),
    'html[data-client-appearance=dark].scope{--client-canvas-image:none;--client-lens:none;--client-action-ink:#102e35;color-scheme:dark}');
  await assert.doesNotReject(assertClientAppearanceArtifact(directory));
});
