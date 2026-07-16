import { describe, expect, it, vi } from 'vitest'
import {
  createStructuredPrd,
  decomposeEpicIntoTickets,
  finalizePlanningSummary,
  generateOneLineEpic,
  syncFinalizedPlanSummary
} from '../services/planningWorkflow'

describe('planning workflow', () => {
  it('creates an editable PRD enriched with Savant context', () => {
    const prd = createStructuredPrd('Workspace planning', [{ source: 'knowledge', summary: 'Teams use two-week sprints' }])
    expect(prd.title).toBe('PRD: Workspace planning')
    expect(prd.content).toContain('Teams use two-week sprints')
    expect(prd.content).toContain('## Acceptance Criteria')
  })

  it('generates a concise epic linked by the caller to the PRD', () => {
    expect(generateOneLineEpic('PRD: Workspace planning', '# Workspace planning\n\n## Problem')).toBe(
      'Enable Workspace planning to deliver its intended user outcome.'
    )
  })

  it('decomposes an epic into reviewable tickets with required fields', () => {
    const tickets = decomposeEpicIntoTickets('Enable workspace planning to deliver its intended user outcome.', [
      { source: 'context', summary: 'Forge uses local sprint state' }
    ])
    expect(tickets).toHaveLength(3)
    expect(tickets.every((ticket) => ticket.title && ticket.description && ticket.acceptance_criteria.length > 0)).toBe(true)
    expect(tickets.every((ticket) => ticket.review_status === 'pending')).toBe(true)
    expect(tickets[0].description).toContain('Forge uses local sprint state')
  })

  it('finalizes only accepted tickets', () => {
    const tickets = decomposeEpicIntoTickets('Deliver planning')
    tickets[0].review_status = 'accepted'
    const summary = finalizePlanningSummary({
      prdId: 'prd-1', prdTitle: 'Planning', epic: 'Deliver planning', tickets, context: []
    })
    expect(summary.tickets).toHaveLength(1)
    expect(summary.tickets[0].review_status).toBe('accepted')
    expect(summary.finalizedAt).toBeTruthy()
  })

  it('publishes a finalized summary to Knowledge without changing the local contract', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }))
    await syncFinalizedPlanSummary('http://forge.test/', 'workspace-1', {
      prdId: 'prd-1', prdTitle: 'Planning', epic: 'Deliver planning', tickets: [], context: [], finalizedAt: 'now'
    }, 'key')
    expect(fetchMock).toHaveBeenCalledWith('http://forge.test/api/knowledge/nodes', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).metadata.workspaces).toEqual(['workspace-1'])
    fetchMock.mockRestore()
  })
})
