import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'))

const stagingFirebaseKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

function redirectRetiredCssV2Path() {
  const redirect = (req, res, next) => {
    const [pathname, query = ''] = (req.url || '').split('?', 2)
    if (pathname !== '/cssV2' && !pathname.startsWith('/cssV2/')) {
      next()
      return
    }

    res.statusCode = 302
    res.setHeader('Location', query ? `/?${query}` : '/')
    res.end()
  }

  return {
    name: 'redirect-retired-css-v2-path',
    configureServer(server) {
      server.middlewares.use(redirect)
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_FIREBASE_')
  const missingStagingKeys = stagingFirebaseKeys.filter((key) => !env[key]?.trim())

  if (mode === 'staging' && missingStagingKeys.length > 0) {
    throw new Error(`Staging Firebase configuration is incomplete: ${missingStagingKeys.join(', ')}`)
  }

  return {
    plugins: [redirectRetiredCssV2Path(), react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/firebase")) return "firebase";
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/")
            ) return "react";
            return undefined;
          },
        },
      },
    },
  }
})
