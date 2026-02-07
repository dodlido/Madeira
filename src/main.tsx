import React from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import App from './App'
import './index.css'
import { UIProvider } from './context/UIContext'

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <UIProvider>
      <App />
    </UIProvider>
  </React.StrictMode>
)
