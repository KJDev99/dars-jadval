import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ToastHost } from './ui/Toast'
import { initTheme } from './ui/theme'
import './index.css'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ToastHost>
        <App />
      </ToastHost>
    </HashRouter>
  </React.StrictMode>,
)
