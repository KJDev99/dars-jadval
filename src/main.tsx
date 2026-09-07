import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { registerServiceWorker } from './lib/pwa'
import './index.css'

// HashRouter — sayt statik hostingda ham server sozlamasisiz ishlaydi
// Ilovani o'rnatish va oflayn ishlashi uchun (faqat yig'ilgan versiyada)
registerServiceWorker(import.meta.env.PROD)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
