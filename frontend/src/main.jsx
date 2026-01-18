import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { Auth0Provider } from '@auth0/auth0-react'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Auth0Provider
      domain="dev-auxamjb2ab0y6cyh.us.auth0.com"
      clientId="8yvpeSxHpnqEv2UIBVplGSDqlS7yxo9j"
      authorizationParams={{ redirect_uri: window.location.origin, audience: "https://personalcfo.com" }}
    >
      <App />
    </Auth0Provider>
  </StrictMode>,
)
