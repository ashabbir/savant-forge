import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendAthenaThreadMessage,
  loadAthenaRuns,
  loadAthenaThreads,
  upsertAthenaRun,
  upsertAthenaThread,
  updateAthenaRun
} from '../services/athenaStore'

describe('athenaStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists Athena threads by context and appends messages', () => {
    upsertAthenaThread({
      id: 'thread-1',
      contextKey: 'squad:squad-alpha',
      contextKind: 'squad',
      title: 'Squad Alpha',
      messages: [
        { id: 'msg-1', sender: 'assistant', text: 'hello', timestamp: '10:00 AM' }
      ],
      lastUpdatedAt: '2026-06-21T10:00:00.000Z'
    })

    appendAthenaThreadMessage('thread-1', {
      id: 'msg-2',
      sender: 'user',
      text: 'plan the squad',
      timestamp: '10:01 AM'
    })

    const threads = loadAthenaThreads()
    expect(threads).toHaveLength(1)
    expect(threads[0].contextKey).toBe('squad:squad-alpha')
    expect(threads[0].messages).toHaveLength(2)
    expect(threads[0].messages[1].text).toBe('plan the squad')
  })

  it('persists Athena runs and updates their status', () => {
    upsertAthenaRun({
      id: 'run-1',
      provider: 'codex',
      model: 'gpt-5-codex',
      status: 'running',
      startedAt: '2026-06-21T10:00:00.000Z',
      prompt: 'hello',
      events: [],
      source: 'local',
      app: 'forge',
      workspace_id: '17807589009121862532574',
      contextKey: 'developer:dev-1',
      contextKind: 'developer'
    })

    updateAthenaRun('run-1', (run) => ({ ...run, status: 'complete', message: 'done' }))

    const runs = loadAthenaRuns()
    expect(runs).toHaveLength(1)
    expect(runs[0].status).toBe('complete')
    expect(runs[0].message).toBe('done')
  })
})
