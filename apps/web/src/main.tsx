import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { lightTheme } from './theme'
import App from './App.tsx'
import './index.css'

import { NotificationProvider } from './components/NotificationProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <BrowserRouter>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
