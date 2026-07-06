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
  system?: {
    loadAthenaThreads: () => import('./services/athenaStore').AthenaThread[]
    saveAthenaThread: (thread: import('./services/athenaStore').AthenaThread) => void
    loadAthenaRuns: () => import('./services/athenaStore').AthenaRunRecord[]
    saveAthenaRun: (run: import('./services/athenaStore').AthenaRunRecord) => void
    saveAthenaRuns: (runs: import('./services/athenaStore').AthenaRunRecord[]) => void
    updateAthenaRun: (runId: string, updater: (run: import('./services/athenaStore').AthenaRunRecord) => import('./services/athenaStore').AthenaRunRecord) => void
    resolveAthenaPersona: (personaId: string, tags?: string[]) => Promise<string>
    loadAthenaMcpTools: () => Promise<Array<{ name: string; description: string }>>
    runAgentViaGateway: (payload: Record<string, unknown>) => Promise<unknown>
    killAthenaRun: (runId: string) => Promise<void>
  }
}
