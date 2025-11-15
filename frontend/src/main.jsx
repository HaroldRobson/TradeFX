import "./polyfills"
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThirdwebProvider } from "@thirdweb-dev/react"

if (!import.meta.env.VITE_THIRDWEB_CLIENT_ID) {
  throw new Error('Missing VITE_THIRDWEB_CLIENT_ID in environment')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThirdwebProvider
      clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID}
      activeChain="ethereum"
    >
      <App />
    </ThirdwebProvider>
  </StrictMode>,
)
