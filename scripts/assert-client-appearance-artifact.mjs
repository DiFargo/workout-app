import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Check emitted CSS, not source: unused CSS Modules can disappear during build.
export async function assertClientAppearanceArtifact(directory) {
  const assets = join(directory, "assets");
  const names = await readdir(assets);
  const css = (await Promise.all(names.filter(name => name.endsWith(".css"))
    .map(name => readFile(join(assets, name), "utf8")))).join("\n");
  const required = [
    /data-client-appearance\s*=\s*["']?dark/,
    /--client-canvas-image\s*:/,
    /--client-lens\s*:/,
    /--client-action-ink\s*:\s*#102e35/i,
    /color-scheme\s*:\s*dark/
  ];
  if (required.some(pattern => !pattern.test(css))) {
    throw new Error("Client appearance CSS is missing from the built artifact; refusing release.");
  }
}
