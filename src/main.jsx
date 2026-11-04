import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { initializeClientAppCheck } from './app/appCheck.js'
import { loadCssVariant } from './app/cssVariant.js'
import { installGlobalErrorReporting } from './utils/errorReporting.js'
import { registerServiceWorker } from './app/registerServiceWorker.js'
import { initializeTelegramMiniApp } from './app/telegramMiniApp.js'
import { acquireTelegramAppInstance } from './app/telegramSingleInstance.js'
import { recordStartupStage } from './utils/performanceChecks.js'

let telegramMiniApp = initializeTelegramMiniApp()
let applicationMounted = false
let telegramInstance = null
// An invitation must remain available for retry after the first window closes.
const hasTelegramInvitation = /^[A-Za-z0-9_-]{20,60}$/.test(new URLSearchParams(window.location.search).get('telegramInvite') || '')

function closeDuplicateTelegramWindow() {
  if (telegramInstance?.status !== 'duplicate' || hasTelegramInvitation) return
  try { telegramMiniApp?.webApp?.close?.() } catch { /* Keep the recovery screen available. */ }
}

function syncTelegramMiniApp() {
  telegramMiniApp = initializeTelegramMiniApp() || telegramMiniApp
  if (applicationMounted) telegramMiniApp?.ready()
  closeDuplicateTelegramWindow()
}

if (!telegramMiniApp) {
  const telegramSdkScript = document.getElementById('telegram-web-app-sdk')
  telegramSdkScript?.addEventListener('load', syncTelegramMiniApp, { once: true })
}

// The startup splash must use the final interface palette from its first frame.
// This prevents a second-looking loading screen while the app runtime mounts.
document.documentElement.dataset.appTheme = 'warm-light'
document.body.dataset.appTheme = 'warm-light'

installGlobalErrorReporting()

async function startApplication() {
  recordStartupStage('entry-evaluated')
  const cssReady = loadCssVariant()
  telegramInstance = await acquireTelegramAppInstance()
  if (telegramInstance.status === 'duplicate') {
    await cssReady
    const { default: TelegramDuplicateWindow } = await import('./app/TelegramDuplicateWindow.jsx')
    createRoot(document.getElementById('root')).render(<TelegramDuplicateWindow hasInvitation={hasTelegramInvitation} />)
    applicationMounted = true
    telegramMiniApp?.ready()
    closeDuplicateTelegramWindow()
    return
  }
  const [{ default: App }] = await Promise.all([import('./App.jsx'), cssReady])
  recordStartupStage('runtime-loaded')

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  applicationMounted = true
  telegramMiniApp?.ready()

  void initializeClientAppCheck().catch((error) => {
    console.warn("App Check initialization failed:", error)
  })
  registerServiceWorker();
}

void startApplication().catch((error) => {
  telegramInstance?.release?.()
  console.error('Application startup failed:', error)
  window.showStartupFailure?.()
})
