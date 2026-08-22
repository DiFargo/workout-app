import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { initializeClientAppCheck } from './app/appCheck.js'
import { loadCssVariant } from './app/cssVariant.js'
import { installGlobalErrorReporting } from './utils/errorReporting.js'
import { registerServiceWorker } from './app/registerServiceWorker.js'

// The startup splash must use the final interface palette from its first frame.
// This prevents a second-looking loading screen while the app runtime mounts.
document.documentElement.dataset.appTheme = 'warm-light'
document.body.dataset.appTheme = 'warm-light'

installGlobalErrorReporting()

async function startApplication() {
  await loadCssVariant().catch(() => {})
  const { default: App } = await import('./App.jsx')

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  void initializeClientAppCheck().catch((error) => {
    console.warn("App Check initialization failed:", error)
  })
  registerServiceWorker();
}

void startApplication()
