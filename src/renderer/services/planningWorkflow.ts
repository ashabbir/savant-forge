import { getStoredApiKey } from './savantClient'

export type PlanningContext = {
  source: string
  summary: string
  citations?: string[]
}

export type GeneratedPlanTicket = {
  id: string
  ticket_key: string
  title: string
  description: string
  acceptance_criteria: string[]
  priority: 'low' | 'medium' | 'high'
  suggested_owner?: string
  suggested_squad?: string
  review_status: 'pending' | 'accepted' | 'rejected'
}

export type PlanningSummary = {
  prdId: string
  prdTitle: string
  epic: string
  tickets: GeneratedPlanTicket[]
  sprintId?: string
  sprintName?: string
  context: PlanningContext[]
  finalizedAt: string
}

const DEFAULT_PRD_TEMPLATE = (idea: string, context: PlanningContext[]) => `# ${idea}\n\n## Problem\n${idea} needs a clear, shared product definition.\n\n## Proposed Outcome\nDescribe the measurable user or business outcome.\n\n## Users and Use Cases\n- Primary user: \n- Job to be done: \n\n## Scope\n### In scope\n- \n\n### Out of scope\n- \n\n## Requirements\n- Functional: \n- Non-functional: \n\n## Acceptance Criteria\n- [ ] The intended outcome is observable and testable.\n\n## Risks and Dependencies\n- \n\n## Savant Context\n${context.length ? context.map((item) => `- ${item.source}: ${item.summary}`).join('\\n') : '- No centralized context was available.'}\n`

export function createStructuredPrd(featureIdea: string, context: PlanningContext[] = []) {
  const idea = featureIdea.trim()
  if (!idea) throw new Error('A feature idea is required')
  return {
    title: `PRD: ${idea}`,
    content: DEFAULT_PRD_TEMPLATE(idea, context),
    context
  }
}

export function generateOneLineEpic(prdTitle: string, prdContent: string) {
  const title = prdTitle.replace(/^PRD:\s*/i, '').trim()
  const heading = prdContent.split(/\r?\n/).find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, '').trim()
  const subject = heading || title || 'feature'
  return `Enable ${subject} to deliver its intended user outcome.`
}

export function decomposeEpicIntoTickets(epic: string, context: PlanningContext[] = []): GeneratedPlanTicket[] {
  const subject = epic.replace(/[.!?]+$/, '').trim() || 'the feature outcome'
  const contextHint = context.length ? ` Informed by ${context.map((item) => `${item.source}: ${item.summary}`).join('; ')}.` : ''
  return [
    {
      id: `plan-ticket-${crypto.randomUUID()}`,
      ticket_key: 'FORGE-PLAN-1',
      title: `Define domain contract for ${subject}`,
      description: `Document the data and service contract required to support ${subject}.${contextHint}`,
      acceptance_criteria: ['Contract fields and ownership are documented.', 'Invalid and missing inputs have defined behavior.'],
      priority: 'high',
      review_status: 'pending'
    },
    {
      id: `plan-ticket-${crypto.randomUUID()}`,
      ticket_key: 'FORGE-PLAN-2',
      title: `Implement user workflow for ${subject}`,
      description: `Build the user-facing workflow that makes ${subject} actionable.${contextHint}`,
      acceptance_criteria: ['Primary user can complete the happy path.', 'Loading, empty, and error states are visible.'],
      priority: 'high',
      review_status: 'pending'
    },
    {
      id: `plan-ticket-${crypto.randomUUID()}`,
      ticket_key: 'FORGE-PLAN-3',
      title: `Verify and observe ${subject}`,
      description: `Add automated coverage and outcome instrumentation for ${subject}.${contextHint}`,
      acceptance_criteria: ['Acceptance criteria are covered by tests.', 'Success and failure signals are available for follow-up.'],
      priority: 'medium',
      review_status: 'pending'
    }
  ]
}

export function updateGeneratedTicket(ticket: GeneratedPlanTicket, patch: Partial<GeneratedPlanTicket>) {
  return { ...ticket, ...patch }
}

export function finalizePlanningSummary(input: Omit<PlanningSummary, 'finalizedAt'>): PlanningSummary {
  const accepted = input.tickets.filter((ticket) => ticket.review_status === 'accepted')
  return { ...input, tickets: accepted, finalizedAt: new Date().toISOString() }
}

/** Fire-and-forget from the UI: local planning never waits for Knowledge. */
export async function syncFinalizedPlanSummary(
  baseUrl: string,
  workspaceId: string,
  summary: PlanningSummary,
  apiKey = getStoredApiKey()
): Promise<void> {
  if (!baseUrl || !workspaceId) return
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/knowledge/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
    body: JSON.stringify({
      title: `Forge plan: ${summary.prdTitle}`,
      node_type: 'insight',
      graph_type: 'business',
      content: JSON.stringify(summary, null, 2),
      metadata: { workspaces: [workspaceId], source: 'savant-forge', prd_id: summary.prdId }
    }),
    signal: AbortSignal.timeout(5000)
  })
  if (!response.ok) throw new Error(`Knowledge sync failed: ${response.status}`)
}
