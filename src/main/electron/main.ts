import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } from 'electron'
import path from 'node:path'
import packageJson from '../../../package.json'
import {
  loadAthenaRuns,
  loadAthenaThreads,
  saveAthenaRuns,
  saveAthenaThreads,
  setAthenaThreadActiveRun,
  upsertAthenaRun,
  upsertAthenaThread,
  updateAthenaRun,
  deleteAthenaThread
} from './athenaDb'

type SavantShellConfig = {
  appName?: string
  icon?: string
}

const shellConfig = (packageJson.savantShell || {}) as SavantShellConfig
const appName = shellConfig.appName || packageJson.productName || packageJson.name
const iconName = shellConfig.icon || 'main.svg'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(__dirname, '../src/renderer/public')

let win: BrowserWindow | null = null
let tray: Tray | null = null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function resolveAsset(name: string) {
  const packaged = path.join(process.resourcesPath || '', 'public', name)
  const devPath = path.join(process.env.VITE_PUBLIC || '', name)
  return app.isPackaged ? packaged : devPath
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#111319',
    title: appName,
    icon: resolveAsset(iconName),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    const devUrl = VITE_DEV_SERVER_URL
    win.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, validatedUrl) => {
      if (validatedUrl.startsWith(devUrl)) {
        setTimeout(() => win?.loadURL(devUrl), 500)
      }
    })
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

function createTray() {
  const trayIconName = 'tray.png'
  let icon = nativeImage.createFromPath(resolveAsset(trayIconName))

  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(resolveAsset(iconName)).resize({ width: 16, height: 16 })
  }

  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)
  tray.setToolTip(appName)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Open ${appName}`, click: () => { win?.show(); win?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]))
}

function registerAthenaIpc() {
  ipcMain.on('athena:load-threads', (event) => {
    event.returnValue = loadAthenaThreads()
  })
  ipcMain.on('athena:save-thread', (event, thread) => {
    upsertAthenaThread(thread)
    event.returnValue = true
  })
  ipcMain.on('athena:delete-thread', (event, threadId) => {
    deleteAthenaThread(threadId)
    event.returnValue = true
  })
  ipcMain.on('athena:load-runs', (event) => {
    event.returnValue = loadAthenaRuns()
  })
  ipcMain.on('athena:save-run', (event, run) => {
    upsertAthenaRun(run)
    event.returnValue = true
  })
  ipcMain.on('athena:save-runs', (event, runs) => {
    saveAthenaRuns(runs)
    event.returnValue = true
  })
  ipcMain.on('athena:update-run', (event, runId, updater) => {
    updateAthenaRun(runId, updater)
    event.returnValue = true
  })
  ipcMain.handle('athena:resolve-persona', async (_event, personaId: string, tags: string[] = []) => {
    const baseUrl = process.env.SAVANT_SERVER_URL || 'http://127.0.0.1:8090'
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/abilities/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: personaId, tags })
    })
    if (!response.ok) return ''
    const data = await response.json()
    return data.prompt || data.persona || ''
  })
  ipcMain.handle('athena:load-tools', async () => {
    const baseUrl = process.env.SAVANT_SERVER_URL || 'http://127.0.0.1:8090'
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/mcp/tools?_=${Date.now()}`)
      if (!response.ok) return []
      const data = await response.json()
      const tools = Array.isArray(data?.tools) ? data.tools : Array.isArray(data) ? data : []
      return tools.slice(0, 20).map((tool: any) => ({
        name: tool.name || 'unknown',
        description: tool.description || ''
      }))
    } catch {
      return []
    }
  })
  ipcMain.handle('athena:run-gateway', async (_event, payload) => {
    const gatewayUrl = process.env.SAVANT_GATEWAY_URL || 'http://127.0.0.1:3100'
    
    // Remove transient properties not expected by the gateway endpoint
    const { tempRunId, workspace_id, contextKey, contextKind, ...gatewayPayload } = payload

    const response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gatewayPayload),
      signal: AbortSignal.timeout(30000)
    })
    if (!response.ok) {
      throw new Error(`Gateway rejected Athena run: ${response.status} ${response.statusText}`)
    }
    const runData = await response.json()
    const runId = String(runData.id || '')
    if (!runId) return runData

    const tRunId = String(tempRunId || '')
    const provider = String(payload.chain?.[0]?.provider || 'codex')
    const model = String(payload.chain?.[0]?.model || 'gpt-5-codex')
    const cKey = String(contextKey || 'global')
    const cKind = String(contextKind || 'global')

    // Broadcast started event with real runId and tempRunId association
    if (win) {
      win.webContents.send('athena:run-event', {
        runId,
        tempRunId: tRunId,
        event: { type: 'started', runId, tempRunId: tRunId }
      })
    }

    try {
      upsertAthenaRun({
        id: runId,
        provider,
        model,
        status: 'running',
        startedAt: new Date().toISOString(),
        prompt: String(payload.prompt || ''),
        message: '',
        events: [{ type: 'thinking', status: 'running', provider, model, reason: 'initiating stream' }],
        source: 'gateway',
        app: 'forge',
        workspace_id: String(workspace_id || ''),
        contextKey: cKey,
        contextKind: cKind as any
      })
    } catch (dbErr) {
      console.error('Failed to pre-insert run in SQLite:', dbErr)
    }

    let assistantText = ''
    try {
      const streamResponse = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/runs/${runId}/stream`)
      if (!streamResponse.ok || !streamResponse.body) return runData

      const reader = streamResponse.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const chunk = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'))
          if (dataLine) {
            const payloadText = dataLine.replace(/^data:\s*/, '')
            try {
              const eventPayload = JSON.parse(payloadText)
              if (eventPayload?.type === 'chunk') {
                assistantText += String(eventPayload.content || '')
              }
              if (eventPayload?.type === 'complete') {
                assistantText = String(eventPayload.content || eventPayload.message || assistantText || '')
              }

              // Send event to renderer
              if (win && eventPayload) {
                win.webContents.send('athena:run-event', { runId, tempRunId: tRunId, event: eventPayload })
              }

              // Save event in DB if it's not a text chunk
              if (eventPayload && eventPayload.type !== 'chunk') {
                updateAthenaRun(runId, (run) => ({
                  ...run,
                  events: [...(run.events || []), eventPayload]
                }))
              }
            } catch {
              // Ignore malformed stream frames and continue consuming.
            }
          }
          boundary = buffer.indexOf('\n\n')
        }
      }

      // Fetch the final run details from the gateway to guarantee we get the full response
      try {
        const finalResponse = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/runs/${runId}`)
        if (finalResponse.ok) {
          const finalRunData = await finalResponse.json()
          if (finalRunData.result?.response || finalRunData.response) {
            assistantText = finalRunData.result.response || finalRunData.response
          }
        }
      } catch (fetchErr) {
        console.error('Failed to fetch final run details:', fetchErr)
      }

      if (win) {
        win.webContents.send('athena:run-event', {
          runId,
          tempRunId: tRunId,
          event: { type: 'complete', status: 'complete', content: assistantText }
        })
      }

      return { ...runData, message: assistantText || runData.message || '' }
    } catch (streamErr) {
      console.error('Error streaming run:', streamErr)
      
      // Try to recover the message from the gateway even if streaming failed
      try {
        const finalResponse = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/runs/${runId}`)
        if (finalResponse.ok) {
          const finalRunData = await finalResponse.json()
          if (finalRunData.result?.response || finalRunData.response) {
            assistantText = finalRunData.result.response || finalRunData.response
            if (win) {
              win.webContents.send('athena:run-event', {
                runId,
                tempRunId: tRunId,
                event: { type: 'complete', status: 'complete', content: assistantText }
              })
            }
            return { ...runData, message: assistantText }
          }
        }
      } catch (fetchErr) {
        console.error('Failed to recover run details after stream error:', fetchErr)
      }

      if (win) {
        win.webContents.send('athena:run-event', {
          runId,
          tempRunId: tRunId,
          event: { type: 'error', status: 'error', message: streamErr instanceof Error ? streamErr.message : String(streamErr) }
        })
      }
      return runData
    }
  })
  ipcMain.handle('athena:kill-run', async (_event, runId: string) => {
    const gatewayUrl = process.env.SAVANT_GATEWAY_URL || 'http://127.0.0.1:3100'
    const response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/runs/${runId}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`Gateway rejected Athena run kill: ${response.status} ${response.statusText}`)
    }
  })
}

app.whenReady().then(() => {
  app.setName(appName)
  registerAthenaIpc()
  createWindow()
  createTray()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
    tray = null
  }
})
