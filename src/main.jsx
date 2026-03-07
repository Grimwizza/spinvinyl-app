import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async';

import { Analytics } from '@vercel/analytics/react'; // Import the tracker
import App from './App.jsx'
import { ThemeProvider } from "./context/ThemeContext"
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider defaultTheme="dark" storageKey="aimlow-theme">
        <App />
        <Analytics />
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>,
)