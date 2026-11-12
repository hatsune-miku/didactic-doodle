import React from 'react'
import ReactDOM from 'react-dom/client'

import '@a1knla/cakeui/style.css'

import App from './App'

import '../../shared/ui.scss'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
