import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

export type AthenaContextKind = 'squad' | 'developer' | 'prd' | 'ticket' | 'blueprint' | 'global' | 'project' | 'feature'

export type AthenaEntityRef = {
  type: AthenaContextKind
  id: string
  name: string
}

export type AthenaThreadMessage = {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
}

export type AthenaThread = {
  id: string
  entity: AthenaEntityRef
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

const sharedSavantDir = path.join(app.getPath('home'), '.savant')
fs.mkdirSync(sharedSavantDir, { recursive: true })
const db = new Database(path.join(sharedSavantDir, 'olympus.db'))

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

  CREATE TABLE IF NOT EXISTS chat_history (
    target_id TEXT PRIMARY KEY,
    messages TEXT NOT NULL,
    title TEXT,
    context TEXT,
    kind TEXT DEFAULT 'general',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

for (const statement of [
  "ALTER TABLE athena_threads ADD COLUMN entityType TEXT NOT NULL DEFAULT 'global'",
  "ALTER TABLE athena_threads ADD COLUMN entityId TEXT NOT NULL DEFAULT 'global'",
  "ALTER TABLE athena_threads ADD COLUMN entityName TEXT NOT NULL DEFAULT 'Athena'"
]) {
  try { db.exec(statement) } catch { /* existing installation */ }
}

db.exec(`
  UPDATE athena_threads
  SET entityType = CASE WHEN instr(contextKey, ':') > 0 THEN substr(contextKey, 1, instr(contextKey, ':') - 1) ELSE contextKind END,
      entityId = CASE WHEN instr(contextKey, ':') > 0 THEN substr(contextKey, instr(contextKey, ':') + 1) ELSE contextKey END,
      entityName = CASE WHEN entityName = 'Athena' THEN title ELSE entityName END
  WHERE entityId = 'global' AND contextKey <> 'global'
`)

const threadUpsert = db.prepare(`
  INSERT INTO chat_history (target_id, messages, title, context, kind, updated_at)
  VALUES (@target_id, @messages, @title, @context, @kind, CURRENT_TIMESTAMP)
  ON CONFLICT(target_id) DO UPDATE SET
    messages=excluded.messages,
    title=COALESCE(excluded.title, chat_history.title),
    context=COALESCE(excluded.context, chat_history.context),
    kind=COALESCE(excluded.kind, chat_history.kind),
    updated_at=CURRENT_TIMESTAMP
`)

function migrateLegacyAthenaThreads() {
  const legacyPath = path.join(app.getPath('userData'), 'athena.db')
  if (path.resolve(legacyPath) === path.resolve(path.join(sharedSavantDir, 'olympus.db')) || !fs.existsSync(legacyPath)) return
  let legacy: { prepare: (sql: string) => { all: () => Array<Record<string, any>> }; close: () => void } | null = null
  try {
    legacy = new Database(legacyPath, { readonly: true })
    if (!legacy) return
    const rows = legacy.prepare('SELECT * FROM athena_threads').all()
    for (const row of rows) {
      const thread = normalizeThread(row)
      const exists = db.prepare('SELECT 1 FROM chat_history WHERE target_id = ?').get(thread.contextKey)
      if (!exists) threadUpsert.run(serializeThread(thread))
    }
  } catch {
    // Legacy persistence is best-effort; shared Olympus history remains authoritative.
  } finally {
    legacy?.close()
  }
}

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

function serializeThread(thread: AthenaThread) {
  const normalized = normalizeThread(thread)
  return {
    target_id: normalized.contextKey,
    title: normalized.title,
    kind: normalized.entity.type,
    context: JSON.stringify({
      threadId: normalized.id,
      entity: normalized.entity,
      contextKey: normalized.contextKey,
      contextKind: normalized.contextKind,
      activeRunId: normalized.activeRunId || ''
    }),
    messages: JSON.stringify(normalized.messages)
  }
}

export function loadAthenaThreads(): AthenaThread[] {
  const rows = db.prepare('SELECT target_id, messages, title, context, kind, updated_at FROM chat_history ORDER BY updated_at ASC').all() as Array<Record<string, any>>
  return rows.map((row) => {
    const context = parseJson<Record<string, any>>(row.context, {})
    return normalizeThread({
      ...context,
      id: context.threadId || `athena-thread-${row.target_id}`,
      contextKey: row.target_id,
      contextKind: context.contextKind || row.kind || 'global',
      entity: context.entity || { type: row.kind || 'global', id: String(row.target_id).split(':').slice(1).join(':'), name: row.title || 'Athena' },
      title: row.title || context.entity?.name || 'Athena',
      messages: parseJson(row.messages, []),
      lastUpdatedAt: row.updated_at || new Date().toISOString()
    })
  })
}

export function saveAthenaThreads(threads: AthenaThread[]) {
  const insert = db.transaction((items: AthenaThread[]) => {
    for (const thread of items) {
      threadUpsert.run(serializeThread(thread))
    }
  })
  insert(threads)
}

export function upsertAthenaThread(thread: AthenaThread) {
  threadUpsert.run(serializeThread(thread))
}

export function deleteAthenaThread(threadId: string) {
  const thread = loadAthenaThreads().find((item) => item.id === threadId)
  if (thread) db.prepare('DELETE FROM chat_history WHERE target_id = ?').run(thread.contextKey)
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
    for (const run of items) {
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
  const raw = thread as Record<string, any>
  const contextKind = (thread.contextKind as AthenaContextKind) || thread.entity?.type || raw.entityType || 'global'
  const contextKey = thread.contextKey || (thread.entity ? `${thread.entity.type}:${thread.entity.id}` : 'global')
  const entity = thread.entity || {
    type: (raw.entityType as AthenaContextKind) || contextKind,
    id: raw.entityId || (contextKey.includes(':') ? contextKey.slice(contextKey.indexOf(':') + 1) : contextKey),
    name: raw.entityName || thread.title || 'Athena'
  }
  return {
    id: thread.id || `athena-thread-${Math.random().toString(36).slice(2, 9)}`,
    entity: { type: entity.type, id: entity.id, name: entity.name || thread.title || 'Athena' },
    contextKey,
    contextKind,
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

migrateLegacyAthenaThreads()
