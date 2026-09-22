import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register the service worker so the app is installable and can load from
// cache when offline. Skipped in dev so Vite's own module reloads aren't
// fought by a stale cached response.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Registered relative to the app's base path so this also works when
    // the app is hosted under a sub-path (e.g. GitHub Pages project sites).
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.error('Service worker registration failed:', err)
    })
  })
}
