import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'))

function versionedServiceWorker() {
  let outputDirectory = ''

  return {
    name: 'versioned-service-worker',
    apply: 'build',
    configResolved(config) {
      outputDirectory = config.build.outDir
    },
    writeBundle() {
      const serviceWorkerPath = fileURLToPath(new URL('./public/sw.js', import.meta.url))
      const serviceWorker = readFileSync(serviceWorkerPath, 'utf8')

      if (!serviceWorker.includes('__APP_VERSION__')) {
        throw new Error('Service worker cache version placeholder is missing')
      }

      writeFileSync(
        resolve(outputDirectory, 'sw.js'),
        serviceWorker.replaceAll('__APP_VERSION__', pkg.version)
      )
    }
  }
}

const stagingFirebaseKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const productionFirebaseProjectId = 'tren-85720'

function isProductionFirebaseHost(hostname) {
  const normalizedHost = String(hostname || '').trim().toLowerCase()
  return normalizedHost === `${productionFirebaseProjectId}.web.app` ||
    normalizedHost.startsWith(`${productionFirebaseProjectId}--`) && normalizedHost.endsWith('.web.app') ||
    normalizedHost === `${productionFirebaseProjectId}.firebaseapp.com` ||
    normalizedHost.endsWith(`-${productionFirebaseProjectId}.cloudfunctions.net`)
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), 'VITE_FIREBASE_'),
    ...loadEnv(mode, process.cwd(), 'VITE_APP_CHECK_'),
    ...loadEnv(mode, process.cwd(), 'VITE_API_')
  }
  const missingFirebaseKeys = stagingFirebaseKeys.filter((key) => !env[key]?.trim())
  const firebaseEnvironment = String(
    env.VITE_FIREBASE_ENVIRONMENT || (mode === 'production' ? 'production' : '')
  ).trim().toLowerCase()
  const usesBundledProductionConfig = firebaseEnvironment === 'production'
  const appCheckDebugToken = String(env.VITE_APP_CHECK_DEBUG_TOKEN || '').trim()
  const apiBaseUrl = String(env.VITE_API_BASE_URL || '').trim()
  let parsedApiBaseUrl = null

  if (usesBundledProductionConfig && mode !== 'production') {
    throw new Error('Bundled production Firebase configuration is allowed only in a production build')
  }

  if (usesBundledProductionConfig && command === 'serve' && !process.argv.includes('preview')) {
    throw new Error('Bundled production Firebase configuration is not allowed in a development server')
  }

  if (!usesBundledProductionConfig && missingFirebaseKeys.length > 0) {
    throw new Error(`Firebase configuration is incomplete: ${missingFirebaseKeys.join(', ')}`)
  }

  if (!usesBundledProductionConfig && env.VITE_FIREBASE_PROJECT_ID === productionFirebaseProjectId) {
    throw new Error('A non-production build cannot use the production Firebase project')
  }

  if (appCheckDebugToken && command === 'build') {
    throw new Error('VITE_APP_CHECK_DEBUG_TOKEN must never be included in a deployable build')
  }

  if (apiBaseUrl) {
    try {
      parsedApiBaseUrl = new URL(apiBaseUrl)
    } catch {
      throw new Error('VITE_API_BASE_URL must be an absolute HTTP(S) origin')
    }

    if (!/^https?:$/i.test(parsedApiBaseUrl.protocol) ||
      parsedApiBaseUrl.username ||
      parsedApiBaseUrl.password ||
      parsedApiBaseUrl.pathname !== '/' ||
      parsedApiBaseUrl.search ||
      parsedApiBaseUrl.hash) {
      throw new Error('VITE_API_BASE_URL must be an absolute HTTP(S) origin')
    }

    if (!usesBundledProductionConfig && isProductionFirebaseHost(parsedApiBaseUrl.hostname)) {
      throw new Error('A non-production VITE_API_BASE_URL cannot target the production Firebase project')
    }
  }

  return {
    plugins: [react(), versionedServiceWorker()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/firebase/storage") ||
              id.includes("node_modules/@firebase/storage")
            ) {
              return "firebase-storage";
            }
            if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
              return "firebase";
            }
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/")
            ) return "react";
            return undefined;
          },
        },
      },
    },
    server: apiBaseUrl
      ? {
          proxy: {
            '/api': {
              target: parsedApiBaseUrl.origin,
              changeOrigin: true
            }
          }
        }
      : undefined
  }
})
