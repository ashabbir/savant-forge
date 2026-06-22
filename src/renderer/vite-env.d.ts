/// <reference types="vite/client" />

interface SavantShellRuntime {
  appName: string
  appVersion: string
  icon: string
  theme: string
  serverUrl: string
  gatewayUrl: string
}

interface Window {
  savantShell?: SavantShellRuntime
}
