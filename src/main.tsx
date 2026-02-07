import React from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import App from './App'
import './index.css'
import { UIProvider } from './context/UIContext'

// expose the background image URL as a CSS variable so index.css can use it
if (typeof document !== 'undefined') {
  try {
    document.documentElement.style.setProperty('--madeira-bg', `url(/Madeira.jpg)`)
  } catch (e) {
    // ignore in non-DOM environments
  }
}

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <UIProvider>
      <App />
    </UIProvider>
  </React.StrictMode>
)
