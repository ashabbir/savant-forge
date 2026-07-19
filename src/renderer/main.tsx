import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers)
  headers.set('X-App-Name', 'savant-forge')
  return nativeFetch(input, { ...init, headers })
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
