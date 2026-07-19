/// <reference types="vite/client" />

declare module 'better-sqlite3' {
  const Database: any
  export default Database
}

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
    deleteAthenaThread: (threadId: string) => void
    loadAthenaRuns: () => import('./services/athenaStore').AthenaRunRecord[]
    saveAthenaRun: (run: import('./services/athenaStore').AthenaRunRecord) => void
    saveAthenaRuns: (runs: import('./services/athenaStore').AthenaRunRecord[]) => void
    updateAthenaRun: (runId: string, updater: (run: import('./services/athenaStore').AthenaRunRecord) => import('./services/athenaStore').AthenaRunRecord) => void
    resolveAthenaPersona: (personaId: string, tags?: string[]) => Promise<string>
    loadAthenaMcpTools: () => Promise<Array<{ name: string; description: string }>>
    runAgentViaGateway: (payload: Record<string, unknown>) => Promise<unknown>
    killAthenaRun: (runId: string) => Promise<void>
    onAthenaRunEvent: (callback: (data: { runId: string; tempRunId?: string; event: any }) => void) => () => void
    onForgeMcpRequest: (callback: (data: { requestId: string; name: string; args: Record<string, unknown> }) => void) => () => void
    resolveForgeMcpRequest: (requestId: string, result: { ok: boolean; value?: unknown; error?: string }) => void
  }
}
