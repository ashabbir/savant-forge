import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  parseStoryPoints,
  getForgeConfig,
  saveForgeConfig,
  fetchJiraTickets,
  updateTicketLocal,
  createTicketLocal,
  deleteTicketLocal,
  triggerSync,
  getLocalPRDs,
  getFeatureRequests,
  saveFeatureRequest,
  saveLocalPRD,
  pushToConfluence,
  getSprintPlans,
  type ForgeConfig,
  type JiraTicket,
  type PRDDocument
} from '../services/localState'
import { setStoredApiKey } from '../services/savantClient'

describe('localState service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('navigator', { onLine: true })
    setStoredApiKey('')
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  describe('Jira Ingest Parse Math', () => {
    it('correctly extracts SP from standard tag formats', () => {
      expect(parseStoryPoints({ title: '[SP-8] Refactor database' })).toBe(8)
      expect(parseStoryPoints({ title: 'Fix auth wrapper [13]' })).toBe(13)
      expect(parseStoryPoints({ title: 'Implement cockpit (5 SP)' })).toBe(5)
    })

    it('falls back to default priority mappings when no tag is present', () => {
      expect(parseStoryPoints({ title: 'Standard task', priority: 'high' })).toBe(8)
      expect(parseStoryPoints({ title: 'Standard task', priority: 'medium' })).toBe(5)
      expect(parseStoryPoints({ title: 'Standard task', priority: 'low' })).toBe(3)
    })
  })

  describe('getForgeConfig & saveForgeConfig', () => {
    it('loads configuration from localStorage if present', async () => {
      const config: ForgeConfig = {
        active_squad_id: 'squad-beta',
        squads: [],
        buffer_threshold: 0.7,
        theme: 'dark',
        current_sprint_id: '',
        company_holidays_by_region: {
          NY: [],
          lisbon: []
        }
      }
      saveForgeConfig(config)

      const result = await getForgeConfig()
      expect(result).toEqual({
        ...config,
        current_project_id: '',
        workdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        athena_provider: 'codex',
        athena_model: 'gpt-5-codex'
      })
    })

    it('fetches default config from file system if localStorage is empty', async () => {
      const configFromFile = {
        active_squad_id: 'squad-alpha',
        squads: [],
        buffer_threshold: 0.9,
        theme: 'olympus',
        current_sprint_id: '',
        company_holidays_by_region: {
          NY: [],
          lisbon: []
        }
      }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(configFromFile)
      } as Response)

      const result = await getForgeConfig()
      expect(result).toEqual({
        ...configFromFile,
        current_project_id: '',
        workdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        athena_provider: 'codex',
        athena_model: 'gpt-5-codex'
      })
      expect(localStorage.getItem('savant_forge_config')).toContain('squad-alpha')
    })

    it('falls back to code default configuration if fetch throws error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('no file'))
      const result = await getForgeConfig()
      expect(result.active_squad_id).toBe('squad-alpha')
      expect(result.buffer_threshold).toBe(0.8)
      expect(result.athena_provider).toBe('codex')
      expect(result.athena_model).toBe('gpt-5-codex')
      expect(result.company_holidays_by_region?.NY).toBeDefined()
      expect(result.company_holidays_by_region?.lisbon).toBeDefined()
    })
  })

  describe('sprint planning and availability storage', () => {
    it('seeds sprint plans when empty', () => {
      const plans = getSprintPlans()
      expect(plans.length).toBeGreaterThan(0)
      expect(plans.some((plan) => plan.status === 'current')).toBe(true)
    })
  })

  describe('fetchJiraTickets', () => {
    it('fetches tickets from server and caches them on success', async () => {
      setStoredApiKey('sk-valid')
      const mockServerTickets = [
        { ticket_id: 't-mock', ticket_key: 'KEY-1', title: 'Ticket 1', priority: 'high' }
      ]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServerTickets)
      } as Response)

      const tickets = await fetchJiraTickets('http://s', 'w-1')
      expect(tickets.length).toBe(1)
      expect(tickets[0].ticket_key).toBe('KEY-1')
      expect(tickets[0].story_points).toBe(8) // parsed from high priority fallback
      expect(localStorage.getItem('savant_forge_tickets')).toContain('KEY-1')
    })

    it('returns cached fallback if network request fails', async () => {
      setStoredApiKey('sk-valid')
      vi.mocked(fetch).mockRejectedValueOnce(new Error('fail'))

      const cached = [{ ticket_id: 't-cached', ticket_key: 'KEY-2', title: 'Cached', story_points: 3 }]
      localStorage.setItem('savant_forge_tickets', JSON.stringify(cached))

      const tickets = await fetchJiraTickets('http://s', 'w-1')
      expect(tickets).toEqual(cached)
    })

    it('generates seed tickets if no cache is present and fetch fails', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
      const tickets = await fetchJiraTickets('http://s', 'w-1')
      expect(tickets.length).toBe(7)
      expect(tickets[0].ticket_key).toBe('JIRA-101')
    })
  })

  describe('updateTicketLocal & createTicketLocal', () => {
    it('updates ticket local cache and queues mutation for sync', async () => {
      const initialTickets = [{ ticket_id: 't-1', workspace_id: 'w-1', ticket_key: 'K-1', title: 'Initial', status: 'todo', priority: 'medium', assignee: '', reporter: 'user', story_points: 5 }]
      localStorage.setItem('savant_forge_tickets', JSON.stringify(initialTickets))

      const updatedTicket: JiraTicket = { ...initialTickets[0], status: 'in_progress', assignee: 'dev-1' }
      await updateTicketLocal('http://s', updatedTicket)

      const cached = JSON.parse(localStorage.getItem('savant_forge_tickets') || '[]')
      expect(cached[0].status).toBe('in_progress')
      expect(cached[0].assignee).toBe('dev-1')

      const queue = JSON.parse(localStorage.getItem('savant_forge_sync_queue') || '[]')
      expect(queue.length).toBe(1)
      expect(queue[0].action).toBe('UPDATE_TICKET')
      expect(queue[0].ticketId).toBe('t-1')
    })

    it('creates ticket in local cache and queues mutation', async () => {
      localStorage.setItem('savant_forge_tickets', JSON.stringify([]))

      const ticketData = { title: '[SP-3] New Task', ticket_key: 'K-NEW', workspace_id: 'w-1' }
      const created = await createTicketLocal('http://s', ticketData)

      expect(created.ticket_id).toBeDefined()
      expect(created.story_points).toBe(3)

      const cached = JSON.parse(localStorage.getItem('savant_forge_tickets') || '[]')
      expect(cached.length).toBe(1)
      expect(cached[0].ticket_key).toBe('K-NEW')

      const queue = JSON.parse(localStorage.getItem('savant_forge_sync_queue') || '[]')
      expect(queue.length).toBe(1)
      expect(queue[0].action).toBe('CREATE_TICKET')
    })

    it('deletes unassigned ticket locally and queues delete mutation', async () => {
      localStorage.setItem('savant_forge_tickets', JSON.stringify([
        { ticket_id: 't-1', workspace_id: 'w-1', ticket_key: 'K-1', title: 'Initial', status: 'todo', priority: 'medium', assignee: '', reporter: 'user', story_points: 5 },
        { ticket_id: 't-2', workspace_id: 'w-1', ticket_key: 'K-2', title: 'Assigned', status: 'todo', priority: 'medium', assignee: 'dev-1', reporter: 'user', story_points: 5 }
      ]))

      setStoredApiKey('sk-valid')
      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

      await deleteTicketLocal('http://s', 't-1')

      const cached = JSON.parse(localStorage.getItem('savant_forge_tickets') || '[]')
      expect(cached.map((ticket: JiraTicket) => ticket.ticket_id)).toEqual(['t-2'])

      const queue = JSON.parse(localStorage.getItem('savant_forge_sync_queue') || '[]')
      expect(queue.length).toBe(0)
    })
  })

  describe('triggerSync', () => {
    it('does nothing if no api key exists or navigator is offline', async () => {
      const queue = [{ action: 'CREATE_TICKET', ticketId: 't-1', payload: {} }]
      localStorage.setItem('savant_forge_sync_queue', JSON.stringify(queue))

      await triggerSync('http://s')
      expect(fetch).not.toHaveBeenCalled()

      setStoredApiKey('sk-valid')
      vi.stubGlobal('navigator', { onLine: false })
      await triggerSync('http://s')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('sends updates/creates to server and clears queue on success', async () => {
      setStoredApiKey('sk-valid')
      const queue = [
        { action: 'UPDATE_TICKET', ticketId: 't-update', payload: { title: 'Updated' } },
        { action: 'CREATE_TICKET', ticketId: 't-create', payload: { title: 'Created' } }
      ]
      localStorage.setItem('savant_forge_sync_queue', JSON.stringify(queue))

      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

      await triggerSync('http://s')

      expect(fetch).toHaveBeenCalledTimes(2)
      const cachedQueue = JSON.parse(localStorage.getItem('savant_forge_sync_queue') || '[]')
      expect(cachedQueue.length).toBe(0)
    })

    it('retains failed mutations in queue', async () => {
      setStoredApiKey('sk-valid')
      const queue = [
        { action: 'UPDATE_TICKET', ticketId: 't-fail', payload: { title: 'Updated' } }
      ]
      localStorage.setItem('savant_forge_sync_queue', JSON.stringify(queue))

      vi.mocked(fetch).mockRejectedValueOnce(new Error('connection timeout'))

      await triggerSync('http://s')

      const cachedQueue = JSON.parse(localStorage.getItem('savant_forge_sync_queue') || '[]')
      expect(cachedQueue.length).toBe(1)
    })

    it('retains 404 update errors in queue in case it has not been created yet', async () => {
      setStoredApiKey('sk-valid')
      const queue = [
        { action: 'UPDATE_TICKET', ticketId: 't-404', payload: { title: 'Updated' } }
      ]
      localStorage.setItem('savant_forge_sync_queue', JSON.stringify(queue))

      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response)

      await triggerSync('http://s')

      const cachedQueue = JSON.parse(localStorage.getItem('savant_forge_sync_queue') || '[]')
      expect(cachedQueue.length).toBe(1)
    })

    it('retains failed CREATE_TICKET mutations when server responds with non-ok', async () => {
      setStoredApiKey('sk-valid')
      const queue = [
        { action: 'CREATE_TICKET', ticketId: 't-create-fail', payload: { title: 'Created' } }
      ]
      localStorage.setItem('savant_forge_sync_queue', JSON.stringify(queue))

      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response)

      await triggerSync('http://s')

      const cachedQueue = JSON.parse(localStorage.getItem('savant_forge_sync_queue') || '[]')
      expect(cachedQueue.length).toBe(1)
    })
  })

  describe('PRD local registry', () => {
    it('returns empty array if no PRDs cached', () => {
      expect(getLocalPRDs()).toEqual([])
    })

    it('saves and reads PRDs correctly', () => {
      const doc: PRDDocument = {
        id: 'prd-1',
        title: 'Title',
        content: 'Content',
        status: 'draft',
        lastUpdated: 'now'
      }

      saveLocalPRD(doc)
      expect(getLocalPRDs()).toEqual([doc])

      const docUpdate: PRDDocument = { ...doc, title: 'Updated Title' }
      saveLocalPRD(docUpdate)
      expect(getLocalPRDs()).toEqual([docUpdate])
    })

    it('pushes PRD to confluence and marks it synced', async () => {
      const doc: PRDDocument = {
        id: 'prd-1',
        title: 'Title',
        content: 'Content',
        status: 'draft',
        lastUpdated: 'now'
      }
      saveLocalPRD(doc)

      const result = await pushToConfluence('prd-1')
      expect(result.status).toBe('synced')
      expect(result.confluenceUrl).toContain('prd-1')
    })

    it('throws error if confluence push fails to find PRD id', async () => {
      await expect(pushToConfluence('non-existent')).rejects.toThrow('PRD not found')
    })

    it('returns empty array if JSON parse throws an error', () => {
      localStorage.setItem('savant_forge_prds', '{invalid-json')
      expect(getLocalPRDs()).toEqual([])
    })

    it('saves and reads PRDs with squadId link correctly', () => {
      const doc: PRDDocument = {
        id: 'prd-linked',
        title: 'Title',
        content: 'Content',
        status: 'draft',
        lastUpdated: 'now',
        squadId: 'squad-alpha'
      }

      saveLocalPRD(doc)
      const prds = getLocalPRDs()
      expect(prds).toContainEqual(doc)
      expect(prds.find(p => p.id === 'prd-linked')?.squadId).toBe('squad-alpha')
    })
  })

  describe('JiraTicket PRD linkage', () => {
    it('saves and triggers update with prd_id correctly', async () => {
      const ticket: JiraTicket = {
        ticket_id: 't-prd-link',
        workspace_id: 'w-1',
        ticket_key: 'J-200',
        title: 'Title',
        status: 'todo',
        priority: 'medium',
        assignee: 'dev-1',
        reporter: 'operator',
        story_points: 3,
        prd_id: 'prd-123'
      }

      localStorage.setItem('savant_forge_tickets', JSON.stringify([ticket]))
      
      const updatedTicket = { ...ticket, prd_id: 'prd-456' }
      await updateTicketLocal('http://s', updatedTicket)

      const cachedQueue = JSON.parse(localStorage.getItem('savant_forge_sync_queue') || '[]')
      expect(cachedQueue.length).toBe(1)
      expect(cachedQueue[0].payload.prd_id).toBe('prd-456')
    })
  })

  describe('FeatureRequest PRD linkage', () => {
    it('normalizes legacy prd_id into prd_ids while preserving the first link', () => {
      localStorage.setItem(
        'savant_forge_features',
        JSON.stringify([
          {
            id: 'feature-1',
            project_id: 'project-1',
            title: 'Feature',
            description: '',
            status: 'draft',
            prd_id: 'prd-a',
            created_at: 'now',
            updated_at: 'later'
          }
        ])
      )

      const features = getFeatureRequests()
      expect(features[0].prd_ids).toEqual(['prd-a'])
      expect(features[0].prd_id).toBe('prd-a')
    })

    it('preserves multiple PRD ids when saved', () => {
      const feature = {
        id: 'feature-2',
        project_id: 'project-1',
        title: 'Feature',
        description: '',
        status: 'draft' as const,
        prd_ids: ['prd-a', 'prd-b'],
        created_at: 'now',
        updated_at: 'later'
      }

      saveFeatureRequest(feature)
      const stored = getFeatureRequests().find((item) => item.id === 'feature-2')
      expect(stored?.prd_ids).toEqual(['prd-a', 'prd-b'])
      expect(stored?.prd_id).toBe('prd-a')
    })
  })
})
