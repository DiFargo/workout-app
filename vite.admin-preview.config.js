import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createPreviewStore, previewMiddleware } from "./dev/admin/store.mjs";

const path = relative => fileURLToPath(new URL(relative, import.meta.url));
const version = JSON.parse(readFileSync(path("./package.json"), "utf8")).version;

// A separate entry/config keeps local identities and transports out of the app.
// Never load .env files, proxy an API, or expose this server on the LAN.
export default defineConfig(({ command }) => {
  if (command !== "serve") throw new Error("Local admin preview cannot be built or deployed");
  return {
    root: path("./dev/admin"),
    publicDir: path("./public"),
    envDir: false,
    envPrefix: "GYMDUCK_LOCAL_PREVIEW_",
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [react(), {
      name: "local-admin-transport",
      configureServer(server) {
        if (!["127.0.0.1", "localhost", "::1"].includes(server.config.server.host)) {
          throw new Error("Local admin preview must bind to loopback");
        }
        server.middlewares.use(previewMiddleware(createPreviewStore()));
      }
    }],
    resolve: {
      alias: [
        { find: /^(?:.*\/)?firebase(?:\.js)?$/, replacement: path("./dev/admin/firebase.js") },
        { find: /^firebase\/firestore$/, replacement: path("./dev/admin/firestore.js") },
        { find: /^(?:.*\/)?apiClient(?:\.js)?$/, replacement: path("./dev/admin/apiClient.js") },
        { find: /^(?:.*\/)?firebaseStorage(?:\.js)?$/, replacement: path("./dev/admin/storage.js") },
        { find: /^(?:.*\/)?protectedExerciseVideo(?:\.js)?$/, replacement: path("./dev/admin/video.js") }
      ]
    },
    server: {
      host: "127.0.0.1", port: 4175, strictPort: true,
      fs: { allow: [path("./")] },
      headers: {
        "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; font-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
        "Cache-Control": "no-store"
      }
    }
  };
});
