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

export function loadAthenaThreads(): AthenaThread[] {
  return readJson<AnyArray>(THREADS_KEY).map((thread) => normalizeThread(thread))
}

export function saveAthenaThreads(threads: AthenaThread[]) {
  localStorage.setItem(THREADS_KEY, JSON.stringify(threads.slice(-40)))
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
  return readJson<AnyArray>(RUNS_KEY).map((run) => normalizeRun(run))
}

export function saveAthenaRuns(runs: AthenaRunRecord[]) {
  localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(-80)))
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

function readJson<T extends AnyArray>(key: string): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return [] as unknown as T
    const parsed = JSON.parse(raw)
    return (Array.isArray(parsed) ? parsed : []) as T
  } catch {
    return [] as unknown as T
  }
}

function dispatchChange() {
  window.dispatchEvent(new Event('savant-forge-athena-changed'))
}
