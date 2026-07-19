import { contextBridge, ipcRenderer } from 'electron'
import packageJson from '../../../package.json'
import type { AthenaRunRecord, AthenaThread } from './athenaDb'

const shellConfig = packageJson.savantShell || {}

contextBridge.exposeInMainWorld('savantShell', {
  appName: shellConfig.appName || packageJson.productName || packageJson.name,
  appVersion: packageJson.version,
  icon: shellConfig.icon || 'main.svg',
  theme: shellConfig.theme || 'obsidian',
  serverUrl: process.env.SAVANT_SERVER_URL || shellConfig.serverUrl || 'http://127.0.0.1:8090',
  gatewayUrl: process.env.SAVANT_GATEWAY_URL || shellConfig.gatewayUrl || 'http://127.0.0.1:3100'
})

contextBridge.exposeInMainWorld('system', {
  loadAthenaThreads: (): AthenaThread[] => ipcRenderer.sendSync('athena:load-threads'),
  saveAthenaThread: (thread: AthenaThread): void => ipcRenderer.send('athena:save-thread', thread),
  deleteAthenaThread: (threadId: string): void => {
    ipcRenderer.sendSync('athena:delete-thread', threadId)
  },
  loadAthenaRuns: (): AthenaRunRecord[] => ipcRenderer.sendSync('athena:load-runs'),
  saveAthenaRun: (run: AthenaRunRecord): void => ipcRenderer.send('athena:save-run', run),
  saveAthenaRuns: (runs: AthenaRunRecord[]): void => ipcRenderer.send('athena:save-runs', runs),
  updateAthenaRun: (runId: string, updater: (run: AthenaRunRecord) => AthenaRunRecord): void =>
    ipcRenderer.sendSync('athena:update-run', runId, updater),
  resolveAthenaPersona: (personaId: string, tags: string[] = []): Promise<string> =>
    ipcRenderer.invoke('athena:resolve-persona', personaId, tags),
  loadAthenaMcpTools: (): Promise<Array<{ name: string; description: string }>> =>
    ipcRenderer.invoke('athena:load-tools'),
  runAgentViaGateway: (payload: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('athena:run-gateway', payload),
  killAthenaRun: (runId: string): Promise<void> =>
    ipcRenderer.invoke('athena:kill-run', runId),
  onAthenaRunEvent: (callback: (data: { runId: string; tempRunId?: string; event: any }) => void): (() => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('athena:run-event', listener)
    return () => {
      ipcRenderer.removeListener('athena:run-event', listener)
    }
  },
  onForgeMcpRequest: (callback: (data: { requestId: string; name: string; args: Record<string, unknown> }) => void): (() => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('forge:mcp-request', listener)
    return () => ipcRenderer.removeListener('forge:mcp-request', listener)
  },
  resolveForgeMcpRequest: (requestId: string, result: { ok: boolean; value?: unknown; error?: string }): void => {
    ipcRenderer.send('forge:mcp-result', requestId, result)
  }
})
