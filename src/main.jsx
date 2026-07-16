import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import { loadCssVariant } from './app/cssVariant.js'
import { registerServiceWorker } from './app/registerServiceWorker.js'

loadCssVariant().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  registerServiceWorker();
})
