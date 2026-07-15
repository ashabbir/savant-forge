import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

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

const db = new Database(path.join(app.getPath('userData'), 'athena.db'))

db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS athena_threads (
    id TEXT PRIMARY KEY,
    contextKey TEXT NOT NULL,
    contextKind TEXT NOT NULL,
    title TEXT NOT NULL,
    messages TEXT NOT NULL,
    activeRunId TEXT NOT NULL DEFAULT '',
    lastUpdatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS athena_runs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    startedAt TEXT NOT NULL,
    endedAt TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    events TEXT NOT NULL,
    source TEXT NOT NULL,
    app TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    contextKey TEXT NOT NULL,
    contextKind TEXT NOT NULL
  );
`)

const threadUpsert = db.prepare(`
  INSERT INTO athena_threads (id, contextKey, contextKind, title, messages, activeRunId, lastUpdatedAt)
  VALUES (@id, @contextKey, @contextKind, @title, @messages, @activeRunId, @lastUpdatedAt)
  ON CONFLICT(id) DO UPDATE SET
    contextKey=excluded.contextKey,
    contextKind=excluded.contextKind,
    title=excluded.title,
    messages=excluded.messages,
    activeRunId=excluded.activeRunId,
    lastUpdatedAt=excluded.lastUpdatedAt
`)

const runUpsert = db.prepare(`
  INSERT INTO athena_runs (id, provider, model, status, startedAt, endedAt, prompt, message, events, source, app, workspace_id, contextKey, contextKind)
  VALUES (@id, @provider, @model, @status, @startedAt, @endedAt, @prompt, @message, @events, @source, @app, @workspace_id, @contextKey, @contextKind)
  ON CONFLICT(id) DO UPDATE SET
    provider=excluded.provider,
    model=excluded.model,
    status=excluded.status,
    startedAt=excluded.startedAt,
    endedAt=excluded.endedAt,
    prompt=excluded.prompt,
    message=excluded.message,
    events=excluded.events,
    source=excluded.source,
    app=excluded.app,
    workspace_id=excluded.workspace_id,
    contextKey=excluded.contextKey,
    contextKind=excluded.contextKind
`)

export function loadAthenaThreads(): AthenaThread[] {
  const rows = db.prepare('SELECT * FROM athena_threads ORDER BY lastUpdatedAt ASC').all() as Array<Record<string, string>>
  return rows.map(normalizeThread)
}

export function saveAthenaThreads(threads: AthenaThread[]) {
  const truncate = db.prepare('DELETE FROM athena_threads')
  const insert = db.transaction((items: AthenaThread[]) => {
    truncate.run()
    for (const thread of items.slice(-40)) {
      threadUpsert.run({
        ...normalizeThread(thread),
        messages: JSON.stringify(normalizeThread(thread).messages)
      })
    }
  })
  insert(threads)
}

export function upsertAthenaThread(thread: AthenaThread) {
  const normalized = normalizeThread(thread)
  threadUpsert.run({ ...normalized, messages: JSON.stringify(normalized.messages) })
}

export function deleteAthenaThread(threadId: string) {
  db.prepare('DELETE FROM athena_threads WHERE id = ?').run(threadId)
}

export function setAthenaThreadActiveRun(threadId: string, runId?: string) {
  const thread = loadAthenaThreads().find((item) => item.id === threadId)
  if (!thread) return
  upsertAthenaThread({ ...thread, activeRunId: runId || '', lastUpdatedAt: new Date().toISOString() })
}

export function loadAthenaRuns(): AthenaRunRecord[] {
  const rows = db.prepare('SELECT * FROM athena_runs ORDER BY startedAt ASC').all() as Array<Record<string, string>>
  return rows.map(normalizeRun)
}

export function saveAthenaRuns(runs: AthenaRunRecord[]) {
  const truncate = db.prepare('DELETE FROM athena_runs')
  const insert = db.transaction((items: AthenaRunRecord[]) => {
    truncate.run()
    for (const run of items.slice(-80)) {
      runUpsert.run({ ...normalizeRun(run), events: JSON.stringify(normalizeRun(run).events) })
    }
  })
  insert(runs)
}

export function upsertAthenaRun(run: AthenaRunRecord) {
  const normalized = normalizeRun(run)
  runUpsert.run({ ...normalized, events: JSON.stringify(normalized.events) })
}

export function updateAthenaRun(runId: string, updater: (run: AthenaRunRecord) => AthenaRunRecord) {
  const existing = loadAthenaRuns().find((item) => item.id === runId)
  if (!existing) return
  upsertAthenaRun(updater(existing))
}

function normalizeThread(thread: Partial<AthenaThread> | Record<string, any>): AthenaThread {
  const messages = typeof thread.messages === 'string'
    ? parseJson(thread.messages, [])
    : (Array.isArray(thread.messages) ? thread.messages : [])
  return {
    id: thread.id || `athena-thread-${Math.random().toString(36).slice(2, 9)}`,
    contextKey: thread.contextKey || 'global',
    contextKind: (thread.contextKind as AthenaContextKind) || 'global',
    title: thread.title || 'Athena',
    messages: Array.isArray(messages) ? messages.map(normalizeMessage) : [],
    activeRunId: thread.activeRunId || '',
    lastUpdatedAt: thread.lastUpdatedAt || new Date().toISOString()
  }
}

function normalizeRun(run: Partial<AthenaRunRecord> | Record<string, any>): AthenaRunRecord {
  const events = typeof run.events === 'string'
    ? parseJson(run.events, [])
    : (Array.isArray(run.events) ? run.events : [])
  return {
    id: run.id || `athena-run-${Math.random().toString(36).slice(2, 9)}`,
    provider: run.provider || 'codex',
    model: run.model || 'gpt-5-codex',
    status: (run.status as AthenaRunRecord['status']) || 'queued',
    startedAt: run.startedAt || new Date().toISOString(),
    endedAt: run.endedAt || '',
    prompt: run.prompt || '',
    message: run.message || '',
    events,
    source: (run.source as AthenaRunRecord['source']) || 'local',
    app: run.app || 'forge',
    workspace_id: run.workspace_id || '',
    contextKey: run.contextKey || 'global',
    contextKind: (run.contextKind as AthenaContextKind) || 'global'
  }
}

function normalizeMessage(message: Partial<AthenaThreadMessage>): AthenaThreadMessage {
  return {
    id: message.id || `msg-${Math.random().toString(36).slice(2, 9)}`,
    sender: message.sender === 'assistant' ? 'assistant' : 'user',
    text: String(message.text || ''),
    timestamp: message.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    if (typeof value !== 'string' || !value) return fallback
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
