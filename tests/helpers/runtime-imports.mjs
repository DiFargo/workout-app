import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Load the actual handlers, substituting only explicit I/O boundaries. Unlike
// extracted function strings, this also exercises their production imports.
export function installRuntimeImports(mocks = {}) {
  const token = `runtime-tests-${Math.random()}`;
  globalThis[token] = mocks;
  const urls = new Map(Object.entries(mocks).map(([name, exports]) => [name,
    `data:text/javascript,${encodeURIComponent(Object.keys(exports).map((key) => `export const ${key} = globalThis[${JSON.stringify(token)}][${JSON.stringify(name)}][${JSON.stringify(key)}];`).join("\n"))}`
  ]));
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (urls.has(specifier)) return { url: urls.get(specifier), shortCircuit: true };
      if (specifier.startsWith(".")) {
        let url = new URL(specifier, context.parentURL);
        if (!/\.[cm]?[jt]sx?$/.test(url.pathname)) url = new URL(url.href + ".js");
        for (const [name, value] of urls) if (url.href.endsWith(name)) return { url: value, shortCircuit: true };
        if (url.protocol === "file:" && existsSync(fileURLToPath(url))) return next(url.href, context);
      }
      return next(specifier, context);
    }
  });
  return () => { hook.deregister(); delete globalThis[token]; };
}
