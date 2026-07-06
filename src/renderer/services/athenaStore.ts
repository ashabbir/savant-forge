export type AthenaContextKind = 'squad' | 'developer' | 'prd' | 'ticket' | 'blueprint' | 'global' | 'project' | 'feature'

export type AthenaThreadMessage = {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
}

export type AthenaThread = {
  id: string
  contextKey: string
  contextKind: AthenaContextKind
  title: string
  messages: AthenaThreadMessage[]
  activeRunId?: string
  lastUpdatedAt: string
}

export type AthenaRunRecord = {
  id: string
  provider: string
  model: string
  status: 'queued' | 'running' | 'complete' | 'error'
  startedAt: string
  endedAt?: string
  prompt: string
  message?: string
  events: Array<Record<string, any>>
  source: 'local' | 'gateway'
  app: string
  workspace_id: string
  contextKey: string
  contextKind: AthenaContextKind
}

const THREADS_KEY = 'savant_forge_athena_threads'
const RUNS_KEY = 'savant_forge_athena_runs'
const memoryStore = {
  threads: [] as AthenaThread[],
  runs: [] as AthenaRunRecord[]
}

function getSystemBridge() {
  return globalThis.window?.system
}

export function loadAthenaThreads(): AthenaThread[] {
  const system = getSystemBridge()
  if (system?.loadAthenaThreads) {
    return system.loadAthenaThreads().map((thread) => normalizeThread(thread))
  }
  return memoryStore.threads.map((thread) => normalizeThread(thread))
}

export function saveAthenaThreads(threads: AthenaThread[]) {
  const normalized = threads.slice(-40).map((thread) => normalizeThread(thread))
  const system = getSystemBridge()
  if (system?.saveAthenaThread) {
    normalized.forEach((thread) => system.saveAthenaThread(thread))
    return
  }
  memoryStore.threads = normalized
}

export function upsertAthenaThread(thread: AthenaThread) {
  const next = loadAthenaThreads()
  const index = next.findIndex((item) => item.id === thread.id)
  if (index >= 0) {
    next[index] = normalizeThread(thread)
  } else {
    next.push(normalizeThread(thread))
  }
  saveAthenaThreads(next)
  dispatchChange()
}

export function appendAthenaThreadMessage(threadId: string, message: AthenaThreadMessage) {
  const next = loadAthenaThreads().map((thread) => {
    if (thread.id !== threadId) return thread
    return {
      ...thread,
      messages: [...thread.messages, message],
      lastUpdatedAt: new Date().toISOString()
    }
  })
  saveAthenaThreads(next)
  dispatchChange()
}

export function deleteAthenaThreadMessage(threadId: string, messageId: string) {
  const next = loadAthenaThreads().map((thread) => {
    if (thread.id !== threadId) return thread
    return {
      ...thread,
      messages: thread.messages.filter((m) => m.id !== messageId),
      lastUpdatedAt: new Date().toISOString()
    }
  })
  saveAthenaThreads(next)
  dispatchChange()
}

export function setAthenaThreadActiveRun(threadId: string, runId?: string) {
  const next = loadAthenaThreads().map((thread) => thread.id === threadId ? { ...thread, activeRunId: runId, lastUpdatedAt: new Date().toISOString() } : thread)
  saveAthenaThreads(next)
  dispatchChange()
}

export function loadAthenaRuns(): AthenaRunRecord[] {
  const system = getSystemBridge()
  if (system?.loadAthenaRuns) {
    return system.loadAthenaRuns().map((run) => normalizeRun(run))
  }
  return memoryStore.runs.map((run) => normalizeRun(run))
}

export function saveAthenaRuns(runs: AthenaRunRecord[]) {
  const normalized = runs.slice(-80).map((run) => normalizeRun(run))
  const system = getSystemBridge()
  if (system?.saveAthenaRuns) {
    system.saveAthenaRuns(normalized)
    return
  }
  memoryStore.runs = normalized
}

export function upsertAthenaRun(run: AthenaRunRecord) {
  const next = loadAthenaRuns()
  const index = next.findIndex((item) => item.id === run.id)
  if (index >= 0) {
    next[index] = normalizeRun(run)
  } else {
    next.push(normalizeRun(run))
  }
  saveAthenaRuns(next)
  dispatchChange()
}

export function updateAthenaRun(runId: string, updater: (run: AthenaRunRecord) => AthenaRunRecord) {
  const next = loadAthenaRuns().map((run) => run.id === runId ? normalizeRun(updater(run)) : run)
  saveAthenaRuns(next)
  dispatchChange()
}

function normalizeThread(thread: Partial<AthenaThread>): AthenaThread {
  return {
    id: thread.id || `athena-thread-${Math.random().toString(36).slice(2, 9)}`,
    contextKey: thread.contextKey || 'global',
    contextKind: thread.contextKind || 'global',
    title: thread.title || 'Athena',
    messages: Array.isArray(thread.messages) ? thread.messages.map((message) => ({
      id: message?.id || `msg-${Math.random().toString(36).slice(2, 9)}`,
      sender: message?.sender === 'assistant' ? 'assistant' : 'user',
      text: String(message?.text || ''),
      timestamp: message?.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })) : [],
    activeRunId: thread.activeRunId || '',
    lastUpdatedAt: thread.lastUpdatedAt || new Date().toISOString()
  }
}

function normalizeRun(run: Partial<AthenaRunRecord>): AthenaRunRecord {
  return {
    id: run.id || `athena-run-${Math.random().toString(36).slice(2, 9)}`,
    provider: run.provider || 'codex',
    model: run.model || 'gpt-5-codex',
    status: run.status || 'queued',
    startedAt: run.startedAt || new Date().toISOString(),
    endedAt: run.endedAt || '',
    prompt: run.prompt || '',
    message: run.message || '',
    events: Array.isArray(run.events) ? run.events : [],
    source: run.source || 'local',
    app: run.app || 'forge',
    workspace_id: run.workspace_id || '',
    contextKey: run.contextKey || 'global',
    contextKind: run.contextKind || 'global'
  }
}

type AnyArray = Array<any>

function dispatchChange() {
  window.dispatchEvent(new Event('savant-forge-athena-changed'))
}
