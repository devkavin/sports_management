import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { TourProvider } from './context/TourContext'
import { NavigationProvider } from './context/NavigationContext'
import { FeedbackProvider } from './context/FeedbackContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FeedbackProvider><AuthProvider>
      <TourProvider>
        <NavigationProvider><App /></NavigationProvider>
      </TourProvider>
    </AuthProvider></FeedbackProvider>
  </React.StrictMode>,
)
