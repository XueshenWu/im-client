import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n/config'
import './stores/languageStore' // Initialize language store

console.log('Renderer process initialized')

// Mount React app
ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Example of using the Electron API exposed through preload
// if (window.electronAPI) {
//   console.log('Electron API is available')
// }
