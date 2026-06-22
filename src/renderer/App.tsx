import { useState, useEffect, FormEvent, useRef, useMemo, type CSSProperties } from 'react'
import {
  Users,
  Layers,
  Sliders,
  Bell,
  Search,
  Info,
  Bot,
  UserRound,
  Power,
  Plus,
  CircleDot,
  Loader,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Sparkles,
  Send,
  FileText,
  Save,
  Check,
  Globe,
  Settings,
  ShieldAlert,
  ArrowRight,
  Shield,
  KeyRound,
  LogIn,
  X,
  Copy,
  Activity,
  Terminal,
  StopCircle,
  RefreshCcw,
  CalendarDays,
  Zap,
  History
} from 'lucide-react'

import {
  checkGatewayHealth,
  checkServerHealth,
  getStoredApiKey,
  listGatewayProviders,
  loadProfile,
  login,
  logout,
  type GatewayProvider,
  type HealthState,
  type SavantProfile
} from './services/savantClient'

import {
  getForgeConfig,
  saveForgeConfig,
  fetchJiraTickets,
  updateTicketLocal,
  createTicketLocal,
  triggerSync,
  getLocalPRDs,
  saveLocalPRD,
  deleteLocalPRD,
  pushToConfluence,
  type ForgeConfig,
  type ProjectEntity,
  type Squad,
  type Developer,
  type JiraTicket,
  type SquadSnapshot,
  type SprintPlan,
  type AvailabilityEvent,
  type PRDDocument,
  getSquadStatsHistory,
  recordSprintSnapshot,
  getSprintPlans,
  saveSprintPlan,
  setCurrentSprintPlan,
  getAvailabilityEvents,
  saveAvailabilityEvent,
  getProjectEntities,
  saveProjectEntity,
  setCurrentProjectEntity,
  getCurrentProjectEntity
} from './services/localState'

import {
  buildAthenaPromptSections,
  fetchAthenaMcpTools
} from './services/athenaContext'
import {
  appendAthenaThreadMessage,
  loadAthenaRuns,
  saveAthenaRuns,
  loadAthenaThreads,
  setAthenaThreadActiveRun,
  type AthenaContextKind,
  type AthenaRunRecord,
  type AthenaThread,
  type AthenaThreadMessage,
  upsertAthenaRun,
  upsertAthenaThread,
  updateAthenaRun
} from './services/athenaStore'

import { appModule } from './appModule'
import { LoginScreen } from './components/LoginScreen'
import { SettingsModal } from './components/SettingsModal'
import { LogoutConfirmModal } from './components/LogoutConfirmModal'
import { SquadCockpit } from './components/SquadCockpit'
import { SquadStatsPanel } from './components/SquadStatsPanel'
import { SprintWorkbenchPanel } from './components/SprintWorkbenchPanel'
import { DeveloperModal, type DeveloperDraft } from './components/DeveloperModal'
import { SpecialtyTagPills, describeSpecialties, normalizeSpecialtyTags } from './components/DeveloperSpecialties'
import { LeftRail } from './components/LeftRail'

const fallbackRuntime = {
  appName: 'Savant Forge',
  appVersion: '1.0.0',
  icon: 'main.svg',
  theme: 'olympus',
  serverUrl: 'http://127.0.0.1:8090',
  gatewayUrl: 'http://127.0.0.1:3100'
}

const FORGE_WORKSPACE_ID = '17807589009121862532574'
const FALLBACK_ATHENA_USER_NAME = 'ahmed'
const DEFAULT_WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

function getAthenaUserName(profile: SavantProfile | null) {
  return profile?.name?.trim() || FALLBACK_ATHENA_USER_NAME
}

function buildAthenaGreeting(userName: string) {
  return `Greetings, ${userName}. I am Athena, your Savant Forge Product copilot. You can talk to me to discover features, draft local PRDs, stage and publish Epics to Confluence, transmit ticket registries directly into Jira, or create and modify Savant entities through app APIs and savant-server MCP tools.`
}

function parsePromptStreamData(data: string) {
  if (!data) return {}
  try {
    return JSON.parse(data)
  } catch {
    return { content: data }
  }
}

function cleanAthenaOutput(text: string): string {
  if (!text) return ''
  const index = text.indexOf('[REQUEST]')
  if (index >= 0) {
    const newlineIndex = text.indexOf('\n', index)
    if (newlineIndex >= 0) {
      return text.slice(newlineIndex + 1).trim()
    }
  }
  return text
}

function buildAthenaContextProfile(params: {
  activeTab: 'squad' | 'projects' | 'blueprint' | 'settings'
  activeSquad: Squad | undefined
  selectedDeveloper: Developer | undefined
  selectedTicket: JiraTicket | undefined
  selectedPrd: PRDDocument | undefined
  config: ForgeConfig | null
}) {
  const { activeTab, activeSquad, selectedDeveloper, selectedTicket, selectedPrd, config } = params
  if (selectedDeveloper) {
    const squad = activeSquad?.name || 'Unassigned squad'
    return {
      kind: 'developer' as const,
      key: `developer:${selectedDeveloper.id}`,
      title: `Developer: ${selectedDeveloper.name}`,
      summary: `Planning context for ${selectedDeveloper.name} in ${squad}. Focus on squad capacity, ticket load, availability, and assignment changes.`,
      promptSections: [
        ['CONTEXT MODE', 'People planning'],
        ['TARGET ENTITY', `developer_id=${selectedDeveloper.id}\nname=${selectedDeveloper.name}\nsquad=${squad}`],
        ['SQUAD CAPACITY', JSON.stringify({
          squad: activeSquad?.name || '',
          raw_capacity: activeSquad?.developers.reduce((acc, dev) => acc + dev.raw_capacity, 0) || 0,
          developers: activeSquad?.developers.map((dev) => ({
            id: dev.id,
            name: dev.name,
            raw_capacity: dev.raw_capacity,
            specialty: dev.specialty,
            specialty_tags: dev.specialty_tags || [],
            working_days: dev.working_days,
            timezone: dev.timezone
          })) || []
        })],
        ['JIRA WORKLOAD', JSON.stringify((activeSquad?.developers.find((dev) => dev.id === selectedDeveloper.id) ? [] : []), null, 2)]
      ] as [string, string][]
    }
  }

  if (selectedPrd) {
    return {
      kind: 'prd' as const,
      key: `prd:${selectedPrd.id}`,
      title: `PRD: ${selectedPrd.title}`,
      summary: 'Architectural and product definition context for PRD authoring, decomposing features into epics, stories, and tasks, then grooming the resulting backlog.',
      promptSections: [
        ['CONTEXT MODE', 'PRD definition'],
        ['TARGET ENTITY', `prd_id=${selectedPrd.id}\ntitle=${selectedPrd.title}`],
        ['PRD CONTENT', selectedPrd.content]
      ] as [string, string][]
    }
  }

  if (selectedTicket) {
    return {
      kind: 'ticket' as const,
      key: `ticket:${selectedTicket.ticket_id}`,
      title: `Ticket: ${selectedTicket.ticket_key}`,
      summary: 'Blueprint/task context for ticket breakdown, prioritization, assignment, and execution planning.',
      promptSections: [
        ['CONTEXT MODE', 'Blueprint / PMO'],
        ['TARGET ENTITY', `ticket_id=${selectedTicket.ticket_id}\nticket_key=${selectedTicket.ticket_key}\nstatus=${selectedTicket.status}\npriority=${selectedTicket.priority}`],
        ['TICKET TITLE', selectedTicket.title]
      ] as [string, string][]
    }
  }

  if (activeTab === 'squad' && activeSquad) {
    return {
      kind: 'squad' as const,
      key: `squad:${activeSquad.id}`,
      title: `Squad: ${activeSquad.name}`,
      summary: 'Squad planning context with developer capacity, working days, availability, and unassigned work.',
      promptSections: [
        ['CONTEXT MODE', 'People planning'],
        ['TARGET ENTITY', `squad_id=${activeSquad.id}\nname=${activeSquad.name}`],
        ['SQUAD MEMBERS', JSON.stringify(activeSquad.developers.map((dev) => ({
          id: dev.id,
          name: dev.name,
          raw_capacity: dev.raw_capacity,
          ranking: dev.ranking,
          specialty: dev.specialty,
          specialty_tags: dev.specialty_tags || [],
          working_days: dev.working_days,
          region: dev.region,
          timezone: dev.timezone
        })), null, 2)],
        ['UNASSIGNED WORK', JSON.stringify((config?.current_project_id ? [] : []), null, 2)]
      ] as [string, string][]
    }
  }

  return {
    kind: activeTab === 'projects' ? 'prd' as const : 'blueprint' as const,
    key: `${activeTab}:global`,
    title: 'Athena',
    summary: 'General Forge context.',
    promptSections: [['CONTEXT MODE', activeTab === 'projects' ? 'PRD / PM-Architect' : 'Blueprint / PMO']] as [string, string][]
  }
}

function getAthenaThreadTitle(kind: AthenaContextKind, title: string, fallback: string) {
  if (kind === 'developer' || kind === 'squad' || kind === 'ticket' || kind === 'prd') return title
  return fallback
}

function createBlankDeveloperDraft(): DeveloperDraft {
  const specialtyTags = normalizeSpecialtyTags([{ label: 'backend/rails', score: 'medium' }], 'Backend')
  return {
    squad_id: 'squad-alpha',
    name: '',
    specialty: describeSpecialties(specialtyTags),
    specialty_tags: specialtyTags,
    ranking: 'Mid',
    raw_capacity: 30,
    region: 'global',
    timezone: 'UTC',
    working_days: [...DEFAULT_WEEKDAYS]
  }
}

function fromDeveloper(dev: Developer | undefined, squadId = 'squad-alpha'): DeveloperDraft {
  if (!dev) return createBlankDeveloperDraft()
  const specialtyTags = normalizeSpecialtyTags(dev.specialty_tags, dev.specialty)
  return {
    id: dev.id,
    squad_id: squadId,
    name: dev.name,
    specialty: describeSpecialties(specialtyTags),
    specialty_tags: specialtyTags,
    ranking: dev.ranking,
    raw_capacity: dev.raw_capacity,
    region: dev.region,
    timezone: dev.timezone,
    working_days: Array.isArray(dev.working_days) && dev.working_days.length ? [...dev.working_days] : [...DEFAULT_WEEKDAYS]
  }
}

function getTimezoneForRegion(region: string): string {
  const r = region.toLowerCase()
  if (r.includes('america') || r === 'na' || r === 'us') return 'America/New_York'
  if (r.includes('europe') || r === 'eu') return 'Europe/London'
  if (r.includes('apac') || r === 'asia') return 'Asia/Singapore'
  return 'UTC'
}

function normalizeWorkingDays(days: string[]) {
  const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const unique = new Set(days.map((day) => day.toLowerCase()))
  return order.filter((day) => unique.has(day))
}

function getStatusBucket(status: string) {
  const normalized = status.toLowerCase().replace(/[\s_-]+/g, '')
  if (['done', 'closed', 'resolved', 'completed', 'complete', 'shipped'].includes(normalized)) {
    return 'done' as const
  }
  if (['inprogress', 'progress', 'doing', 'review', 'inreview', 'blocked', 'qa', 'testing'].includes(normalized)) {
    return 'inprogress' as const
  }
  return 'todo' as const
}

function getDeveloperSpecialties(dev: Developer) {
  return normalizeSpecialtyTags(dev.specialty_tags, dev.specialty)
}

function groupDeveloperTicketsByEpic(tickets: JiraTicket[]) {
  const buckets = new Map<string, { epicKey: string; epicTitle: string; items: { todo: JiraTicket[]; inprogress: JiraTicket[]; done: JiraTicket[] } }>()

  tickets.forEach((ticket) => {
    const epicKey = ticket.epic_ticket_id || ticket.parent_ticket_id || ticket.project_id || 'unlinked'
    const epicTitle = ticket.epic_ticket_id || ticket.parent_ticket_id || ticket.project_id || 'Unlinked Work'
    if (!buckets.has(epicKey)) {
      buckets.set(epicKey, {
        epicKey,
        epicTitle,
        items: { todo: [], inprogress: [], done: [] }
      })
    }
    const bucket = buckets.get(epicKey)!
    bucket.items[getStatusBucket(ticket.status)].push(ticket)
  })

  return Array.from(buckets.values()).sort((a, b) => a.epicTitle.localeCompare(b.epicTitle))
}

function getDeveloperSquadId(config: ForgeConfig | null, developerId: string) {
  const squad = config?.squads.find((item) => item.developers.some((dev) => dev.id === developerId))
  return squad?.id || config?.active_squad_id || 'squad-alpha'
}

function App() {
  const runtime = window.savantShell || fallbackRuntime
  
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('savant_server_url') || runtime.serverUrl
  })
  const [gatewayUrl, setGatewayUrl] = useState(() => {
    return localStorage.getItem('savant_gateway_url') || runtime.gatewayUrl
  })

  // Connections & Profiles
  const [serverHealth, setServerHealth] = useState<HealthState>({ status: 'checking', detail: serverUrl })
  const [gatewayHealth, setGatewayHealth] = useState<HealthState>({ status: 'checking', detail: gatewayUrl })
  const [profile, setProfile] = useState<SavantProfile | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [gatewayProviders, setGatewayProviders] = useState<GatewayProvider[]>([])

  // Forge Domain Data
  const [config, setConfig] = useState<ForgeConfig | null>(null)
  const [tickets, setTickets] = useState<JiraTicket[]>([])
  const [squadStatsHistory, setSquadStatsHistory] = useState<SquadSnapshot[]>(() => getSquadStatsHistory())
  const [sprintPlans, setSprintPlans] = useState<SprintPlan[]>(() => getSprintPlans())
  const [availabilityEvents, setAvailabilityEvents] = useState<AvailabilityEvent[]>(() => getAvailabilityEvents())
  const [activeTab, setActiveTab] = useState<'squad' | 'projects' | 'blueprint' | 'settings'>('blueprint')
  const [productSubTab, setProductSubTab] = useState<'athena' | 'blueprints'>('blueprints')
  const [isLeftPaneOpen, setIsLeftPaneOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState('ticket-inspector')
  const [isDeveloperModalOpen, setIsDeveloperModalOpen] = useState(false)
  const [developerModalMode, setDeveloperModalMode] = useState<'add' | 'edit'>('add')
  const [developerDraft, setDeveloperDraft] = useState<DeveloperDraft>(createBlankDeveloperDraft())

  function handleSelectTab(tab: 'squad' | 'projects' | 'blueprint') {
    setSelectedTicketId(null)
    setSelectedDeveloperId(null)
    setSelectedPrdId(null)
    if (activeTab === tab) {
      setIsLeftPaneOpen(!isLeftPaneOpen)
    } else {
      setActiveTab(tab)
      setIsLeftPaneOpen(true)
      if (tab === 'blueprint') {
        setRightPanelTab('ticket-inspector')
      } else if (tab === 'projects') {
        setRightPanelTab('prd-inspector')
      } else if (tab === 'squad') {
        setRightPanelTab('dev-inspector')
      }
    }
  }

  function handleSelectProductSubTab(sub: 'athena' | 'blueprints') {
    setProductSubTab(sub)
    setSelectedTicketId(null)
    setSelectedDeveloperId(null)
    setSelectedPrdId(null)
    if (sub === 'athena') {
      setRightPanelTab('prd-inspector')
    } else {
      setRightPanelTab('ticket-inspector')
    }
  }

  const [selectedSquadId, setSelectedSquadId] = useState<string>('squad-alpha')
  
  // Persistent Right Context Rail State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // PRD States
  const [prds, setPrds] = useState<PRDDocument[]>([])
  const [selectedPrdId, setSelectedPrdId] = useState<string | null>(null)
  const [isCreatingPrd, setIsCreatingPrd] = useState(false)
  const [newPrdTitle, setNewPrdTitle] = useState('')
  const [newPrdContent, setNewPrdContent] = useState('')

  const currentSprint = useMemo(() => {
    if (!config?.current_sprint_id) return sprintPlans.find((plan) => plan.status === 'current') || null
    return sprintPlans.find((plan) => plan.id === config.current_sprint_id) || sprintPlans.find((plan) => plan.status === 'current') || null
  }, [config?.current_sprint_id, sprintPlans])

  // Athena Chat Console States
  const [athenaThreads, setAthenaThreads] = useState<AthenaThread[]>(() => loadAthenaThreads())
  const [activeAthenaThreadId, setActiveAthenaThreadId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<AthenaThreadMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // New ticket modal/form states
  const [newTicketTitle, setNewTicketTitle] = useState('')
  const [newTicketKey, setNewTicketKey] = useState('')
  const [newTicketSp, setNewTicketSp] = useState('5')
  const [newTicketPriority, setNewTicketPriority] = useState('medium')

  // Find active squad
  const activeSquad = config?.squads.find(s => s.id === selectedSquadId) || config?.squads[0]
  const latestSquadSnapshot = squadStatsHistory[squadStatsHistory.length - 1] || null

  // Calculate Developer allocations & buffer math
  const devLoadStats = activeSquad?.developers.map(dev => {
    const assignedTickets = tickets.filter(t => {
      if (t.assignee !== dev.id) return false
      if (config?.current_sprint_id) {
        return t.sprint_id === config.current_sprint_id
      }
      return true
    })
    const totalPoints = assignedTickets.reduce((acc, t) => acc + (t.story_points || 0), 0)
    const snapshotDev = latestSquadSnapshot?.developers.find((item) => item.developer_id === dev.id)
    const effectiveCapacity = snapshotDev?.effective_capacity || dev.raw_capacity * 0.8
    const ratio = effectiveCapacity > 0 ? totalPoints / effectiveCapacity : 0
    
    const isOverload = totalPoints > effectiveCapacity
    const statusColor = isOverload
      ? 'destructive'
      : totalPoints === effectiveCapacity
      ? 'perfect'
      : 'cyan'

    return {
      dev,
      assignedTickets,
      totalPoints,
      effectiveCapacity,
      ratio,
      isOverload,
      statusColor,
      availabilityRatio: snapshotDev?.availability_ratio || 1,
      availableDays: snapshotDev?.available_days || 0,
      plannedDays: snapshotDev?.planned_days || 0,
      companyHolidays: snapshotDev?.company_holidays || 0,
      personalTimeOff: snapshotDev?.personal_time_off || 0,
      deliveredPoints: snapshotDev?.delivered_points || 0,
      openPoints: snapshotDev?.open_points || 0,
      overduePoints: snapshotDev?.overdue_points || 0,
      workloadLabel: snapshotDev?.workload_label || (totalPoints <= 0 ? 'FREE' : isOverload ? 'OVERWORKED' : ratio >= 0.8 ? 'NORMAL' : 'HAPPY')
    }
  }) || []

  // Check if squad cumulative capacity is overloaded
  const squadCapacityStats = (() => {
    if (!activeSquad) return { totalRaw: 0, totalEffective: 0, assigned: 0, isOverload: false }
    const totalRaw = activeSquad.developers.reduce((acc, d) => acc + d.raw_capacity, 0)
    const totalEffective = latestSquadSnapshot?.available_capacity || totalRaw * 0.8
    const assigned = tickets.filter(t => {
      const isAssignedToSquad = activeSquad.developers.some(d => d.id === t.assignee)
      if (!isAssignedToSquad) return false
      if (config?.current_sprint_id) {
        return t.sprint_id === config.current_sprint_id
      }
      return true
    }).reduce((acc, t) => acc + t.story_points, 0)
    return {
      totalRaw,
      totalEffective,
      assigned,
      isOverload: assigned > totalEffective
    }
  })()

  // Filtered tickets list for blueprint center panel
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.ticket_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })
  const squadScopedUnassignedTickets = filteredTickets.filter((ticket) => {
    if (ticket.assignee) return false
    if (!config?.current_project_id) return true
    return ticket.project_id === config.current_project_id || !ticket.project_id
  })

  const selectedTicket = tickets.find(t => t.ticket_id === selectedTicketId)
  const selectedDeveloper = activeSquad?.developers.find(d => d.id === selectedDeveloperId)
  const selectedDevStats = devLoadStats.find(s => s.dev.id === selectedDeveloperId)
  const selectedPrd = prds.find(p => p.id === selectedPrdId)
  const selectedDeveloperSpecialties = selectedDeveloper ? getDeveloperSpecialties(selectedDeveloper) : []
  const athenaContextProfile = useMemo(() => buildAthenaContextProfile({
    activeTab,
    activeSquad,
    selectedDeveloper: selectedDeveloper || undefined,
    selectedTicket: selectedTicket || undefined,
    selectedPrd: selectedPrd || undefined,
    config
  }), [activeTab, activeSquad, selectedDeveloper, selectedTicket, selectedPrd, config])

  const currentAthenaThread = useMemo(() => {
    return athenaThreads.find((thread) => thread.contextKey === athenaContextProfile.key) || null
  }, [athenaThreads, athenaContextProfile.key])

  const athenaPersona = useMemo(() => {
    if (athenaContextProfile.kind === 'prd') {
      return {
        name: 'ARCHITECT & PRODUCT',
        description: 'Systems architecture & product manager persona',
        systemPromptText: 'Act as an expert Systems Architect and Product Manager. Focus on systems design, decomposing high-level requirements into clear components, drafting product requirement documents (PRDs), and outlining epics and user stories with technical feasibility.'
      }
    } else if (athenaContextProfile.kind === 'ticket' || athenaContextProfile.kind === 'squad' || athenaContextProfile.kind === 'developer' || athenaContextProfile.kind === 'blueprint') {
      return {
        name: 'ENGINEER',
        description: 'Software engineer & tech lead persona',
        systemPromptText: 'Act as a Senior Software Engineer and Tech Lead. Focus on implementation details, backlog grooming, story point estimation, technical complexity, code structure, task breakdown, and technical execution planning.'
      }
    } else {
      return {
        name: 'GENERAL COPILOT',
        description: 'General system support & operational assistant persona',
        systemPromptText: 'Act as a helpful general copilot for Savant Forge management, assisting with configuration and operational queries.'
      }
    }
  }, [athenaContextProfile.kind])

  async function refreshConnections() {
    setServerHealth({ status: 'checking', detail: serverUrl })
    setGatewayHealth({ status: 'checking', detail: gatewayUrl })
    const [server, gateway] = await Promise.all([
      checkServerHealth(serverUrl),
      checkGatewayHealth(gatewayUrl)
    ])
    setServerHealth(server)
    setGatewayHealth(gateway)
    try {
      setGatewayProviders(await listGatewayProviders(gatewayUrl))
    } catch {
      setGatewayProviders([])
    }
  }

  async function refreshProfile() {
    if (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || (import.meta as any).env?.MODE === 'test')) {
      setProfile({ userId: 'ahmed', name: 'ahmed', role: 'admin' })
      await loadDomainData()
      return
    }
    const nextProfile = await loadProfile(serverUrl)
    setProfile(nextProfile)
    await loadDomainData()
  }

  async function loadDomainData() {
    const cfg = await getForgeConfig()
    setConfig(cfg)
    if (cfg.active_squad_id) {
      setSelectedSquadId(cfg.active_squad_id)
    }

    const activeWorkspaceId = '17807589009121862532574'
    const fetchedTickets = await fetchJiraTickets(serverUrl, activeWorkspaceId)
    setTickets(fetchedTickets)
    setPrds(getLocalPRDs())
    setSprintPlans(getSprintPlans())
    setAvailabilityEvents(getAvailabilityEvents())
    const snapshot = recordSprintSnapshot(cfg.squads.find((squad) => squad.id === cfg.active_squad_id), fetchedTickets)
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  async function handleLoginWithKey(key: string) {
    const nextProfile = await login(serverUrl, key)
    setProfile(nextProfile)
    await loadDomainData()
  }

  function handleLogout() {
    logout()
    setProfile(null)
    setTickets([])
    setIsSettingsOpen(false)
    setIsLogoutConfirmOpen(false)
  }

  // Handle Drag & Drop / Move ticket to Developer capability slot
  async function assignTicketToDeveloper(ticketId: string, devId: string) {
    const ticket = tickets.find(t => t.ticket_id === ticketId)
    if (!ticket) return
    const updated = { 
      ...ticket, 
      assignee: devId,
      sprint_id: ticket.sprint_id || config?.current_sprint_id || undefined
    }
    const nextTickets = tickets.map((t) => t.ticket_id === ticketId ? updated : t)
    setTickets(nextTickets)
    await updateTicketLocal(serverUrl, updated)
    const snapshot = recordSprintSnapshot(activeSquad, nextTickets)
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  async function unassignTicket(ticketId: string) {
    const ticket = tickets.find(t => t.ticket_id === ticketId)
    if (!ticket) return
    const updated = { ...ticket, assignee: '' }
    const nextTickets = tickets.map((t) => t.ticket_id === ticketId ? updated : t)
    setTickets(nextTickets)
    await updateTicketLocal(serverUrl, updated)
    const snapshot = recordSprintSnapshot(activeSquad, nextTickets)
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  async function handleCreateTicket(event: FormEvent) {
    event.preventDefault()
    if (!newTicketTitle || !newTicketKey) return

    const spText = `[SP-${newTicketSp}]`
    const finalTitle = newTicketTitle.toLowerCase().includes('sp-') 
      ? newTicketTitle 
      : `${spText} ${newTicketTitle}`

    const activeWorkspaceId = '17807589009121862532574'
    try {
      const created = await createTicketLocal(serverUrl, {
        workspace_id: activeWorkspaceId,
        ticket_key: newTicketKey,
        title: finalTitle,
        status: 'todo',
        priority: newTicketPriority,
        reporter: profile?.name || 'ahmed'
      })

      setTickets(prev => [...prev, created])
      const nextTickets = [...tickets, created]
      const snapshot = recordSprintSnapshot(activeSquad, nextTickets)
      if (snapshot) {
        setSquadStatsHistory(getSquadStatsHistory())
      }
      setNewTicketTitle('')
      setNewTicketKey('')
      setSelectedTicketId(created.ticket_id)
    } catch (e) {
      console.error(e)
    }
  }

  async function triggerManualSync() {
    setIsSyncing(true)
    await triggerSync(serverUrl)
    const activeWorkspaceId = '17807589009121862532574'
    const fetched = await fetchJiraTickets(serverUrl, activeWorkspaceId)
    setTickets(fetched)
    const snapshot = recordSprintSnapshot(activeSquad, fetched)
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
    setIsSyncing(false)
  }

  function handleCreateSprint(draft: { name: string; start_date: string; end_date: string; goal: string }) {
    if (!activeSquad) return
    const plan: SprintPlan = {
      id: `sprint_${Math.random().toString(36).slice(2, 9)}`,
      squad_id: activeSquad.id,
      name: draft.name,
      start_date: draft.start_date,
      end_date: draft.end_date,
      status: 'planned',
      goals: [
        {
          id: `goal_${Math.random().toString(36).slice(2, 9)}`,
          title: draft.goal,
          description: draft.goal,
          status: 'planned'
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    saveSprintPlan(plan)
    setSprintPlans(getSprintPlans())
  }

  function handleSetCurrentSprint(sprintId: string) {
    setCurrentSprintPlan(sprintId)
    setConfig((prev) => prev ? { ...prev, current_sprint_id: sprintId } : prev)
    setSprintPlans(getSprintPlans())
    const snapshot = recordSprintSnapshot(activeSquad, tickets)
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  function handleCompleteSprint(sprintId: string) {
    const next = getSprintPlans().map((plan) => plan.id === sprintId
      ? { ...plan, status: 'complete' as const, updated_at: new Date().toISOString() }
      : plan)
    localStorage.setItem('savant_forge_sprints', JSON.stringify(next))
    setConfig((prev) => prev && prev.current_sprint_id === sprintId ? { ...prev, current_sprint_id: '' } : prev)
    setSprintPlans(getSprintPlans())
  }

  function handleUpdateSprintGoals(sprintId: string, goals: SprintPlan['goals']) {
    const next = getSprintPlans().map((plan) => plan.id === sprintId
      ? { ...plan, goals, updated_at: new Date().toISOString() }
      : plan)
    localStorage.setItem('savant_forge_sprints', JSON.stringify(next))
    setSprintPlans(getSprintPlans())
    const snapshot = recordSprintSnapshot(activeSquad, tickets)
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  function handleUpdateSquadName(squadId: string, newName: string) {
    if (!config) return
    const updatedSquads = config.squads.map(s => s.id === squadId ? { ...s, name: newName } : s)
    const updatedConfig = { ...config, squads: updatedSquads }
    setConfig(updatedConfig)
    saveForgeConfig(updatedConfig)
  }

  function handleUpdateSprint(sprintId: string, fields: Partial<SprintPlan>) {
    const next = getSprintPlans().map((plan) => plan.id === sprintId
      ? { ...plan, ...fields, updated_at: new Date().toISOString() }
      : plan)
    localStorage.setItem('savant_forge_sprints', JSON.stringify(next))
    setSprintPlans(getSprintPlans())
    const snapshot = recordSprintSnapshot(activeSquad, tickets)
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  function handleDeleteSprint(sprintId: string) {
    const next = getSprintPlans().filter((plan) => plan.id !== sprintId)
    localStorage.setItem('savant_forge_sprints', JSON.stringify(next))
    setSprintPlans(getSprintPlans())
    if (config?.current_sprint_id === sprintId) {
      setConfig((prev) => prev ? { ...prev, current_sprint_id: '' } : prev)
    }
  }

  function handleCreateSquad(name: string) {
    if (!config) return
    const newSquad: Squad = {
      id: `squad-${Math.random().toString(36).slice(2, 9)}`,
      name,
      developers: []
    }
    const updatedConfig = { ...config, squads: [...config.squads, newSquad] }
    setConfig(updatedConfig)
    saveForgeConfig(updatedConfig)
    setSelectedSquadId(newSquad.id)
  }

  function handleAddAvailabilityEvent(draft: {
    developer_id: string
    type: AvailabilityEvent['type']
    title: string
    start_date: string
    end_date: string
    notes?: string
  }) {
    const event: AvailabilityEvent = {
      id: `availability_${Math.random().toString(36).slice(2, 9)}`,
      developer_id: draft.developer_id,
      type: draft.type,
      title: draft.title,
      start_date: draft.start_date,
      end_date: draft.end_date,
      notes: draft.notes,
      created_at: new Date().toISOString()
    }
    saveAvailabilityEvent(event)
    setAvailabilityEvents(getAvailabilityEvents())
    const snapshot = recordSprintSnapshot(activeSquad, tickets)
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  // Athena Chat Form Submit & Agent Engine Call
  async function handleSendAthenaMessage(e?: FormEvent) {
    if (e) e.preventDefault()
    if (!chatInput.trim()) return
    if (!athenaContextProfile) return

    const userMsg: AthenaThreadMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const threadId = activeAthenaThreadId || `athena-thread-${athenaContextProfile.key}`
    const threadTitle = getAthenaThreadTitle(athenaContextProfile.kind, athenaContextProfile.title, 'Athena')

    upsertAthenaThread({
      id: threadId,
      contextKey: athenaContextProfile.key,
      contextKind: athenaContextProfile.kind,
      title: threadTitle,
      messages: chatMessages.length > 0 ? [...chatMessages, userMsg] : [userMsg],
      activeRunId: '',
      lastUpdatedAt: new Date().toISOString()
    })
    setChatMessages((prev) => [...prev, userMsg])

    const promptText = chatInput
    setChatInput('')
    setIsAiLoading(true)

    const tempRunId = `run_${Date.now()}`

    try {
      const mcpTools = await fetchAthenaMcpTools(serverUrl, getStoredApiKey() || 'test-key')
      const provider = config?.athena_provider || 'codex'
      const model = config?.athena_model || 'gpt-5-codex'

      const systemPrompt = buildAthenaPromptSections([
        ['ACTIVE PERSONA', athenaPersona.systemPromptText],
        ['AVAILABLE MCP TOOLS', mcpTools.map((t: any) => `- ${t.name}: ${t.description}`).join('\n')],
        ['ATHENA RUNTIME', `provider=${provider}\nmodel=${model}`],
        ...athenaContextProfile.promptSections
      ])

      const currentUserName = getAthenaUserName(profile)
      const composedPrompt = [
        systemPrompt,
        '',
        `[USER] ${currentUserName}`,
        `[REQUEST] ${promptText}`
      ].join('\n')

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      const startedAt = new Date().toISOString()
      upsertAthenaRun({
        id: tempRunId,
        provider,
        model,
        status: 'running',
        startedAt,
        prompt: promptText,
        message: '',
        events: [{ type: 'thinking', status: 'running', provider, model, reason: 'initiating request' }],
        source: 'local',
        app: 'forge',
        workspace_id: FORGE_WORKSPACE_ID,
        contextKey: athenaContextProfile.key,
        contextKind: athenaContextProfile.kind
      })
      setAthenaThreadActiveRun(threadId, tempRunId)

      const response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/runs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: composedPrompt,
          chain: [{ provider, model }],
          cwd: '/Users/home/code/project-x/savant-forge',
          contextKey: athenaContextProfile.key,
          contextKind: athenaContextProfile.kind,
          threadId
        }),
        signal: AbortSignal.timeout(30000)
      })

      if (!response.ok) {
        throw new Error(`Gateway rejected Athena run: ${response.status} ${response.statusText}`)
      }

      const runData = await response.json()
      const runId = String(runData.id || tempRunId)

      if (runId !== tempRunId) {
        const currentRuns = loadAthenaRuns().filter((r) => r.id !== tempRunId)
        saveAthenaRuns(currentRuns)
      }

      upsertAthenaRun({
        id: runId,
        provider,
        model,
        status: 'running',
        startedAt,
        prompt: promptText,
        message: '',
        events: [{ type: 'thinking', status: 'running', provider, model, reason: 'submitted to gateway' }],
        source: 'local',
        app: 'forge',
        workspace_id: FORGE_WORKSPACE_ID,
        contextKey: athenaContextProfile.key,
        contextKind: athenaContextProfile.kind
      })
      setAthenaThreadActiveRun(threadId, runId)

      const eventSource = new EventSource(`${gatewayUrl.replace(/\/+$/, '')}/runs/${runId}/stream`)
      let assistantText = ''

      eventSource.onmessage = (event) => {
        const payload = parsePromptStreamData(event.data || '')
        const type = payload.type || 'chunk'

        if (type === 'thinking') {
          updateAthenaRun(runId, (run) => ({
            ...run,
            events: [...run.events, {
              type: 'thinking',
              status: payload.status || 'running',
              provider: payload.provider || provider,
              model: payload.model || model,
              reason: payload.reason || payload.message || ''
            }]
          }))
        } else if (type === 'chunk') {
          const content = String(payload.content || '')
          assistantText += content
          updateAthenaRun(runId, (run) => ({
            ...run,
            events: [...run.events, { type: 'chunk', content }]
          }))
        } else if (type === 'complete') {
          const finalText = String(payload.content || payload.message || assistantText || 'Run completed.')
          assistantText = finalText
          updateAthenaRun(runId, (run) => ({
            ...run,
            status: 'complete',
            endedAt: new Date().toISOString(),
            message: finalText,
            events: [...run.events, { type: 'complete', status: 'complete', content: finalText }]
          }))
          const cleanText = cleanAthenaOutput(finalText)
          appendAthenaThreadMessage(threadId, {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            text: cleanText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })
          setAthenaThreadActiveRun(threadId, '')
          setChatMessages((prev) => [...prev, {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            text: cleanText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }])
          setIsAiLoading(false)
          eventSource.close()
        } else if (type === 'error') {
          const message = payload.message || payload.error || 'Athena run failed.'
          updateAthenaRun(runId, (run) => ({
            ...run,
            status: 'error',
            endedAt: new Date().toISOString(),
            message,
            events: [...run.events, { type: 'error', status: 'error', message }]
          }))
          appendAthenaThreadMessage(threadId, {
            id: `ai-error-${Date.now()}`,
            sender: 'assistant',
            text: `Athena error: ${message}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })
          setAthenaThreadActiveRun(threadId, '')
          setChatMessages((prev) => [...prev, {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            text: `Athena error: ${message}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }])
          setIsAiLoading(false)
          eventSource.close()
        }
      }

      eventSource.onerror = (err) => {
        console.error('EventSource connection error:', err)
        if (eventSource.readyState === EventSource.CLOSED) return
        
        const message = 'Connection to stream closed unexpectedly.'
        updateAthenaRun(runId, (run) => {
          if (run.status === 'complete' || run.status === 'error') return run
          return {
            ...run,
            status: 'error',
            endedAt: new Date().toISOString(),
            message,
            events: [...run.events, { type: 'error', status: 'error', message }]
          }
        })
        appendAthenaThreadMessage(threadId, {
          id: `ai-error-${Date.now()}`,
          sender: 'assistant',
          text: `Athena error: ${message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })
        setAthenaThreadActiveRun(threadId, '')
        setChatMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.text.includes('Athena error')) return prev
          return [...prev, {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            text: `Athena error: ${message}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]
        })
        setIsAiLoading(false)
        eventSource.close()
      }

    } catch (e: any) {
      console.error(e)
      const errMessage = e?.message || 'run submission failed'
      
      updateAthenaRun(tempRunId, (run) => ({
        ...run,
        status: 'error',
        endedAt: new Date().toISOString(),
        message: `Athena error: ${errMessage}`,
        events: [...run.events, { type: 'error', status: 'error', message: errMessage }]
      }))

      appendAthenaThreadMessage(threadId, {
        id: `ai-fallback-${Date.now()}`,
        sender: 'assistant',
        text: `Athena error: ${errMessage}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })
      setChatMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: `Athena error: ${errMessage}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
      setIsAiLoading(false)
      setAthenaThreadActiveRun(threadId, '')
    }
  }

  async function handleCopyAthenaMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Failed to copy Athena response', error)
    }
  }

  function handleDeleteAthenaMessage(messageId: string) {
    setChatMessages((prev) => prev.filter((message) => message.id !== messageId))
  }

  // Handle PRD Creation manually
  function handleSaveManualPrd(e: FormEvent) {
    e.preventDefault()
    if (!newPrdTitle) return
    const newPrd: PRDDocument = {
      id: `prd-${Math.random().toString(36).slice(2, 10)}`,
      title: newPrdTitle,
      content: newPrdContent || `# ${newPrdTitle}\n\nPRD content template...`,
      status: 'draft',
      lastUpdated: new Date().toISOString()
    }
    const updated = saveLocalPRD(newPrd)
    setPrds(updated)
    setNewPrdTitle('')
    setNewPrdContent('')
    setIsCreatingPrd(false)
    setSelectedPrdId(newPrd.id)
  }

  function handleDeletePrd(prdId: string) {
    if (confirm("Are you sure you want to delete this PRD?")) {
      const updated = deleteLocalPRD(prdId)
      setPrds(updated)
      if (selectedPrdId === prdId) {
        setSelectedPrdId(null)
      }
    }
  }

  async function handlePushToConfluence(prdId: string) {
    try {
      const updated = await pushToConfluence(prdId)
      setPrds(prev => prev.map(p => p.id === prdId ? updated : p))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    refreshConnections()
    refreshProfile()
    const timer = window.setInterval(refreshConnections, 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (chatEndRef.current && typeof chatEndRef.current.scrollIntoView === 'function') {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  useEffect(() => {
    const userName = getAthenaUserName(profile)
    const greeting: AthenaThreadMessage = {
      id: 'init',
      sender: 'assistant',
      text: buildAthenaGreeting(userName),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const existing = athenaThreads.find((thread) => thread.contextKey === athenaContextProfile.key)
    if (!existing) {
      const createdThread: AthenaThread = {
        id: `athena-thread-${athenaContextProfile.key}`,
        contextKey: athenaContextProfile.key,
        contextKind: athenaContextProfile.kind,
        title: getAthenaThreadTitle(athenaContextProfile.kind, athenaContextProfile.title, 'Athena'),
        messages: [greeting],
        lastUpdatedAt: new Date().toISOString()
      }
      upsertAthenaThread(createdThread)
      setActiveAthenaThreadId(createdThread.id)
      setChatMessages(createdThread.messages)
      return
    }

    const normalizedMessages = existing.messages.length > 0 ? existing.messages : [greeting]
    if (existing.messages.length === 0) {
      upsertAthenaThread({ ...existing, messages: normalizedMessages })
    }
    setActiveAthenaThreadId(existing.id)
    setChatMessages(normalizedMessages)
  }, [profile, athenaContextProfile.key, athenaContextProfile.kind, athenaContextProfile.title, athenaThreads])

  useEffect(() => {
    function refreshAthenaThreads() {
      setAthenaThreads(loadAthenaThreads())
    }
    refreshAthenaThreads()
    window.addEventListener('savant-forge-athena-changed', refreshAthenaThreads as EventListener)
    window.addEventListener('storage', refreshAthenaThreads)
    return () => {
      window.removeEventListener('savant-forge-athena-changed', refreshAthenaThreads as EventListener)
      window.removeEventListener('storage', refreshAthenaThreads)
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setRightPanelOpen(false)
        setIsSettingsOpen(false)
        setIsLogoutConfirmOpen(false)
        setIsDeveloperModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Declarations moved to top of App component body to resolve hoisting

  function handleRightRailClick(tab: string) {
    if (rightPanelOpen && rightPanelTab === tab) {
      setRightPanelOpen(false)
    } else {
      setRightPanelTab(tab)
      setRightPanelOpen(true)
    }
  }

  function openAddDeveloperModal() {
    const seed = activeSquad?.developers[0]
    const squadId = activeSquad?.id || config?.active_squad_id || 'squad-alpha'
    setDeveloperModalMode('add')
    setDeveloperDraft(seed ? {
      ...createBlankDeveloperDraft(),
      squad_id: squadId,
      region: seed.region,
      timezone: seed.timezone,
      specialty: describeSpecialties(normalizeSpecialtyTags(seed.specialty_tags, seed.specialty)),
      specialty_tags: normalizeSpecialtyTags(seed.specialty_tags, seed.specialty),
      ranking: seed.ranking,
      raw_capacity: seed.raw_capacity,
      working_days: Array.isArray(seed.working_days) && seed.working_days.length ? [...seed.working_days] : [...DEFAULT_WEEKDAYS]
    } : { ...createBlankDeveloperDraft(), squad_id: squadId })
    setIsDeveloperModalOpen(true)
  }

  function openEditDeveloperModal(dev: Developer) {
    const squadId = getDeveloperSquadId(config, dev.id)
    setDeveloperModalMode('edit')
    setDeveloperDraft(fromDeveloper(dev, squadId))
    setIsDeveloperModalOpen(true)
  }

  function handleSaveDeveloper() {
    if (!config) return
    const targetSquadId = developerDraft.squad_id || activeSquad?.id || config.active_squad_id
    const sourceSquadId = developerModalMode === 'edit' && developerDraft.id
      ? getDeveloperSquadId(config, developerDraft.id)
      : targetSquadId
    const nextDev: Developer = {
      id: developerModalMode === 'edit' && developerDraft.id ? developerDraft.id : `dev-${Math.random().toString(36).slice(2, 8)}`,
      name: developerDraft.name.trim() || 'Developer',
      specialty: describeSpecialties(normalizeSpecialtyTags(developerDraft.specialty_tags, developerDraft.specialty)),
      specialty_tags: normalizeSpecialtyTags(developerDraft.specialty_tags, developerDraft.specialty),
      ranking: developerDraft.ranking || 'Mid',
      raw_capacity: Number.isFinite(developerDraft.raw_capacity) ? developerDraft.raw_capacity : 30,
      region: developerDraft.region || 'global',
      timezone: getTimezoneForRegion(developerDraft.region || 'global'),
      working_days: config.workdays && config.workdays.length > 0 ? config.workdays : [...DEFAULT_WEEKDAYS]
    }

    const nextSquads = (config?.squads || []).map((squad) => {
      if (developerModalMode === 'edit' && sourceSquadId !== targetSquadId) {
        if (squad.id === sourceSquadId) {
          return { ...squad, developers: squad.developers.filter((dev) => dev.id !== nextDev.id) }
        }
        if (squad.id === targetSquadId) {
          const developers = [...squad.developers.filter((dev) => dev.id !== nextDev.id), nextDev]
          return { ...squad, developers }
        }
        return squad
      }

      if (squad.id !== targetSquadId) return squad
      const developers = developerModalMode === 'edit'
        ? squad.developers.map((dev) => dev.id === nextDev.id ? nextDev : dev)
        : [...squad.developers.filter((dev) => dev.id !== nextDev.id), nextDev]
      return { ...squad, developers }
    })

    const updatedConfig = config ? { ...config, squads: nextSquads } : config
    if (!updatedConfig) return
    setConfig(updatedConfig)
    saveForgeConfig(updatedConfig)
    setSelectedDeveloperId(nextDev.id)
    setSelectedSquadId(targetSquadId)
    setIsDeveloperModalOpen(false)
  }

  return (
    <div className="app-shell" data-theme={runtime.theme}>
      <div className="scanline-overlay" />

      {/* Top Bar Header */}
      <header className="top-bar">
        <div className="top-spacer" />
        <div className="title-block flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--cp-cyan), var(--cp-purple))', boxShadow: 'var(--cp-glow-cyan)', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="./main.svg" alt="Forge" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span style={{ fontFamily: "'Orbitron', monospace", color: 'var(--cp-cyan)', textShadow: 'var(--cp-glow-cyan)', letterSpacing: '0.15em', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>FORGE</span>
        </div>
        <div className="top-spacer top-actions">
          <button className="connection-pill" onClick={triggerManualSync} title="Trigger Background Sync">
            {isSyncing ? <Loader size={9} className="animate-spin" /> : <RefreshCw size={9} />}
            sync
          </button>
          <ConnectionPill label="srv" health={serverHealth} />
          <ConnectionPill label="gw" health={gatewayHealth} />
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="body-row">
        {/* Left Sidebar Rail */}
        <aside className="icon-rail" style={{ background: 'var(--cp-bg-1)', borderRight: '1px solid var(--cp-border)' }}>
          <div className="rail-top">
            {/* 1. SQUAD (Users icon) */}
            <button 
              className={`nav-icon ${activeTab === 'squad' ? 'active' : ''}`}
              onClick={() => handleSelectTab('squad')}
              title="squad"
            >
              <Users size={16} />
              <span className="rail-label-text">squad</span>
            </button>

            {/* 2. PROJECTS (FileText icon) */}
            <button 
              className={`nav-icon ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => handleSelectTab('projects')}
              title="projects"
            >
              <FileText size={16} />
              <span className="rail-label-text">projects</span>
            </button>

            {/* 3. BLUE PRINT (Layers icon) */}
            <button 
              className={`nav-icon ${activeTab === 'blueprint' ? 'active' : ''}`}
              onClick={() => handleSelectTab('blueprint')}
              title="blueprints"
            >
              <Layers size={16} />
              <span className="rail-label-text">blueprints</span>
            </button>
          </div>
          
          <div className="rail-bottom">
            <button 
              className="nav-icon"
              onClick={() => setIsLeftPaneOpen(!isLeftPaneOpen)}
              title={isLeftPaneOpen ? "Collapse Left Panel" : "Expand Left Panel"}
              style={{ marginBottom: '8px' }}
            >
              {isLeftPaneOpen ? (
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
            <button 
              className={`nav-icon ${isSettingsOpen ? 'active' : ''}`}
              onClick={() => setIsSettingsOpen(true)}
              title="settings"
            >
              <Sliders size={16} />
              <span className="rail-label-text">settings</span>
            </button>
            <button 
              className={`nav-icon logout-icon ${isLogoutConfirmOpen ? 'active' : ''}`} 
              onClick={() => setIsLogoutConfirmOpen(true)} 
              title="Logout"
            >
              <Power size={16} />
            </button>
          </div>
        </aside>

        {/* Collapsible Left Side Pane / Drawer */}
        {isLeftPaneOpen && (
          <aside className="left-sidebar" style={{ width: '280px', display: 'flex', flexDirection: 'column', background: 'var(--cp-bg-1)', borderRight: '1px solid var(--cp-border)' }}>
            {activeTab === 'projects' && (
              <>
                <div className="session-panel-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Local PRD Registry</span>
                  <button 
                    onClick={() => setIsCreatingPrd(!isCreatingPrd)}
                    style={{
                      background: 'rgba(0, 229, 255, 0.1)',
                      border: '1px solid var(--cp-cyan)',
                      color: 'var(--cp-cyan)',
                      fontSize: '9px',
                      fontFamily: "'Share Tech Mono', monospace",
                      padding: '1px 4px'
                    }}
                  >
                    {isCreatingPrd ? 'CANCEL' : '+ PRD'}
                  </button>
                </div>
                
                <div style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {isCreatingPrd ? (
                    <form onSubmit={handleSaveManualPrd} style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--cp-bg-2)', padding: '8px', border: '1px solid var(--cp-border)' }}>
                      <input 
                        type="text" 
                        placeholder="PRD Title..."
                        value={newPrdTitle}
                        onChange={e => setNewPrdTitle(e.target.value)}
                        required
                        style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--foreground)', fontSize: '11px', padding: '4px', outline: 'none' }}
                      />
                      <textarea 
                        placeholder="PRD Requirements content..."
                        value={newPrdContent}
                        onChange={e => setNewPrdContent(e.target.value)}
                        rows={6}
                        style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--foreground)', fontSize: '11px', padding: '4px', resize: 'none', outline: 'none' }}
                      />
                      <button type="submit" style={{ background: 'var(--cp-cyan)', color: 'var(--cp-bg-0)', border: '0', fontSize: '11px', padding: '6px', fontWeight: 'bold' }}>
                        SAVE PRD
                      </button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {prds.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => {
                            setSelectedPrdId(p.id)
                            setSelectedTicketId(null)
                            setSelectedDeveloperId(null)
                            setRightPanelTab('prd-inspector')
                            setRightPanelOpen(true)
                          }}
                          style={{
                            background: selectedPrdId === p.id ? 'rgba(0, 229, 255, 0.08)' : 'var(--cp-bg-2)',
                            border: selectedPrdId === p.id ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                            padding: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ color: p.status === 'synced' ? 'var(--cp-green)' : 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '130px' }}>
                            {p.title}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '9px', opacity: 0.6, fontFamily: "'Share Tech Mono', monospace" }}>{p.status.toUpperCase()}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeletePrd(p.id)
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--cp-magenta)',
                                opacity: 0.7,
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'grid',
                                placeItems: 'center'
                              }}
                              title="Delete PRD"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'blueprint' && (
              <>
                <div className="session-panel-header" style={{ width: '100%' }}>
                  <span>Blueprints ({filteredTickets.length})</span>
                </div>
                <div style={{ padding: '8px', borderBottom: '1px solid var(--cp-border)' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={11} style={{ position: 'absolute', left: '8px', color: 'var(--cp-cyan)', opacity: 0.5 }} />
                    <input 
                      type="text" 
                      placeholder="search tickets..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--cp-bg-3)',
                        border: '1px solid var(--cp-border)',
                        color: 'var(--foreground)',
                        fontSize: '11px',
                        fontFamily: "'Share Tech Mono', monospace",
                        padding: '4px 8px 4px 24px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, padding: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredTickets.map(t => {
                    const isSelected = selectedTicketId === t.ticket_id
                    return (
                      <div 
                        key={t.ticket_id}
                        onClick={() => {
                          setSelectedTicketId(t.ticket_id)
                          setSelectedDeveloperId(null)
                          setSelectedPrdId(null)
                          setRightPanelTab('ticket-inspector')
                          setRightPanelOpen(true)
                        }}
                        style={{
                          background: isSelected ? 'rgba(0, 229, 255, 0.08)' : 'var(--cp-bg-2)',
                          border: isSelected ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                          padding: '6px 8px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", fontWeight: 'bold' }}>{t.ticket_key}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '130px', textAlign: 'left', marginLeft: '6px' }}>{t.title.replace(/\[SP-\d+\]\s*/i, '')}</span>
                        <span style={{ color: 'var(--cp-green)', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>{t.story_points}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {activeTab === 'squad' && (
              <>
                <div className="session-panel-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Squads ({config?.squads?.length || 0})</span>
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt('Enter new squad name:')
                      if (name && name.trim()) {
                        handleCreateSquad(name.trim())
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--cp-cyan)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: "'Share Tech Mono', monospace",
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      padding: '0 4px'
                    }}
                  >
                    <Plus size={11} /> ADD
                  </button>
                </div>
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--cp-border)' }}>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {(config?.squads || []).map((squad) => {
                      const squadTickets = tickets.filter((ticket) => squad.developers.some((dev) => dev.id === ticket.assignee))
                      const isSelected = selectedSquadId === squad.id
                      const assignedPoints = squadTickets.reduce((acc, ticket) => acc + ticket.story_points, 0)
                      return (
                        <button
                          key={squad.id}
                          type="button"
                          onClick={() => {
                            setSelectedSquadId(squad.id)
                            setSelectedDeveloperId(null)
                            setSelectedTicketId(null)
                            setSelectedPrdId(null)
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            background: isSelected ? 'rgba(0, 229, 255, 0.08)' : 'var(--cp-bg-2)',
                            border: isSelected ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'grid',
                            gap: '4px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 'bold' }}>
                              {squad.name.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--muted-foreground)' }}>
                              {squad.developers.length} ppl
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '10px', fontFamily: "'Share Tech Mono', monospace" }}>
                            <span style={{ color: 'var(--cp-cyan)' }}>
                              {squadTickets.length} tickets
                            </span>
                            <span style={{ color: 'var(--cp-green)' }}>
                              {assignedPoints} SP
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="session-panel-header" style={{ width: '100%', marginTop: '4px' }}>
                    <span>Unassigned Tickets ({squadScopedUnassignedTickets.length})</span>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={11} style={{ position: 'absolute', left: '8px', color: 'var(--cp-cyan)', opacity: 0.5 }} />
                    <input 
                      type="text" 
                      placeholder="search tickets..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--cp-bg-3)',
                        border: '1px solid var(--cp-border)',
                        color: 'var(--foreground)',
                        fontSize: '11px',
                        fontFamily: "'Share Tech Mono', monospace",
                        padding: '4px 8px 4px 24px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
                
                <div className="session-tree" style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
                  {squadScopedUnassignedTickets.length === 0 ? (
                    <div style={{ color: 'var(--muted-foreground)', opacity: 0.4, padding: '20px 10px', fontSize: '11px', fontStyle: 'italic', textAlign: 'center' }}>
                      All blueprints matched!
                    </div>
                  ) : (
                    squadScopedUnassignedTickets.map(ticket => (
                      <div 
                        key={ticket.ticket_id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', ticket.ticket_id)}
                        onClick={() => {
                          setSelectedTicketId(ticket.ticket_id)
                          setSelectedDeveloperId(null)
                          setSelectedPrdId(null)
                          setRightPanelTab('ticket-inspector')
                          setRightPanelOpen(true)
                        }}
                        className={`ticket-drag-card ${selectedTicketId === ticket.ticket_id ? 'active' : ''}`}
                        style={{
                          background: 'var(--cp-bg-2)',
                          border: selectedTicketId === ticket.ticket_id ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                          padding: '8px',
                          marginBottom: '6px',
                          cursor: 'grab',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--cp-cyan)', fontSize: '11px', fontWeight: 'bold' }}>
                            {ticket.ticket_key}
                          </span>
                          <span 
                            style={{ 
                              fontFamily: "'Share Tech Mono', monospace", 
                              fontSize: '9px',
                              padding: '1px 4px',
                              background: 'rgba(255, 0, 170, 0.1)',
                              color: 'var(--cp-magenta)',
                              border: '1px solid rgba(255, 0, 170, 0.2)'
                            }}
                          >
                            {ticket.priority.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.title}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--cp-cyan)', opacity: 0.8 }}>
                            {ticket.sprint_id ? sprintPlans.find(p => p.id === ticket.sprint_id)?.name || 'Linked' : 'Backlog'}
                          </span>
                          <span style={{ color: 'var(--cp-green)', fontSize: '11px', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>
                            {ticket.story_points} SP
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                </div>
              </>
            )}
          </aside>
        )}

        {/* Center Panel Workspace: The Drag Targets and Capability Grid */}
        <main className="chat-area" style={{ flex: 1, padding: '16px', background: 'var(--cp-bg-0)', display: 'flex', flexDirection: 'column' }}>
          
          {activeTab === 'projects' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="session-panel-header" style={{ width: '100%', marginBottom: '8px' }}>
                <span>PROJECT FEATURES & PRDS</span>
              </div>
              {selectedPrd ? (
                <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--cp-cyan)', fontFamily: "'Orbitron', sans-serif" }}>
                      {selectedPrd.title}
                    </h2>
                    <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                      Last updated: {new Date(selectedPrd.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                  <pre style={{ margin: 0, fontSize: '12px', color: 'var(--foreground)', background: 'var(--cp-bg-3)', padding: '12px', whiteSpace: 'pre-wrap', flex: 1, overflowY: 'auto', border: '1px solid var(--cp-border)' }}>
                    {selectedPrd.content}
                  </pre>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', color: 'var(--muted-foreground)', fontSize: '13px', fontStyle: 'italic' }}>
                  Select a project PRD from the registry sidebar or click '+ PRD' to start feature discovery.
                </div>
              )}
            </div>
          )}

          {activeTab === 'squad' && (
              <SquadCockpit
                activeSquad={activeSquad}
                squadCapacityStats={squadCapacityStats}
                devLoadStats={devLoadStats}
                selectedDeveloperId={selectedDeveloperId}
                setSelectedDeveloperId={setSelectedDeveloperId}
                setSelectedTicketId={setSelectedTicketId}
                setSelectedPrdId={setSelectedPrdId}
                setRightPanelTab={setRightPanelTab}
                setRightPanelOpen={setRightPanelOpen}
                assignTicketToDeveloper={assignTicketToDeveloper}
                openAddDeveloperModal={openAddDeveloperModal}
                sprintPlans={sprintPlans}
                currentSprint={currentSprint}
                onCreateSprint={handleCreateSprint}
                onSetCurrentSprint={handleSetCurrentSprint}
                onCompleteSprint={handleCompleteSprint}
                onUpdateSprintGoals={handleUpdateSprintGoals}
                onUpdateSprint={handleUpdateSprint}
                onDeleteSprint={handleDeleteSprint}
                onUpdateSquadName={handleUpdateSquadName}
                onCreateSquad={handleCreateSquad}
              />
            )}

          {activeTab === 'blueprint' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--cp-cyan)', fontFamily: "'Orbitron', sans-serif" }}>
                JIRA BLUEPRINTS INGEST ENGINE
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                Direct corporate ticket pool synced offline. Intercept mutations via local storage and queue for background gateway transmits.
              </div>

              <div style={{ border: '1px solid var(--cp-border)', background: 'var(--cp-bg-2)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--cp-bg-3)', borderBottom: '1px solid var(--cp-border)', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
                      <th style={{ padding: '8px' }}>KEY</th>
                      <th style={{ padding: '8px' }}>TITLE</th>
                      <th style={{ padding: '8px' }}>STORY POINTS</th>
                      <th style={{ padding: '8px' }}>ASSIGNEE</th>
                      <th style={{ padding: '8px' }}>PRIORITY</th>
                      <th style={{ padding: '8px' }}>SPRINT</th>
                      <th style={{ padding: '8px' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(t => {
                      const assigneeDev = activeSquad?.developers.find(d => d.id === t.assignee)
                      return (
                        <tr 
                          key={t.ticket_id} 
                          onClick={() => {
                            setSelectedTicketId(t.ticket_id)
                            setSelectedPrdId(null)
                            setRightPanelTab('ticket-inspector')
                            setRightPanelOpen(true)
                          }}
                          style={{ 
                            borderBottom: '1px solid var(--cp-border)', 
                            cursor: 'pointer',
                            background: selectedTicketId === t.ticket_id ? 'rgba(0, 229, 255, 0.05)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '8px', color: 'var(--cp-cyan)', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>{t.ticket_key}</td>
                          <td style={{ padding: '8px' }}>{t.title}</td>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{t.story_points} SP</td>
                          <td style={{ padding: '8px', color: assigneeDev ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                            {assigneeDev ? assigneeDev.name : 'Unassigned'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span style={{ fontSize: '10px', padding: '2px 4px', background: 'rgba(255,0,170,0.1)', color: 'var(--cp-magenta)' }}>
                              {t.priority.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '8px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
                            {t.sprint_id ? sprintPlans.find(p => p.id === t.sprint_id)?.name || 'Linked' : 'Backlog'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span style={{ color: t.status === 'done' ? 'var(--cp-green)' : t.status === 'in_progress' ? 'var(--cp-yellow)' : 'var(--foreground)' }}>
                              {t.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar Drawer */}
        {rightPanelOpen && (
          <aside 
            className="right-panel right-drawer" 
          >
            <div className="right-label" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>// {rightPanelTab.replace('-', ' ')}</span>
              <button 
                onClick={() => setRightPanelOpen(false)}
                style={{ background: 'transparent', border: 0, padding: 0, color: 'var(--cp-cyan)', display: 'flex', alignItems: 'center' }}
                title="Collapse right inspector"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="telemetry-content" style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              {/* Telemetry/Inspector Panels */}
              {rightPanelTab === 'athena-chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: '100%' }}>
                  <div style={{ fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '8px' }}>
                    ATHENA PM COPILOT CONVERSATION
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <StatusBadge label={`PERSONA: ${athenaPersona.name}`} />
                    <StatusBadge label={`PROVIDER: ${config?.athena_provider || 'codex'}`} />
                    <StatusBadge label={`MODEL: ${config?.athena_model || 'gpt-5-codex'}`} />
                  </div>
                  {/* Chat messages viewport */}
                  <div 
                    style={{ 
                      flex: 1, 
                      background: 'var(--cp-bg-2)', 
                      border: '1px solid var(--cp-border)',
                      padding: '10px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      maxHeight: '420px'
                    }}
                  >
                    {chatMessages.map(msg => (
                      <div key={msg.id} style={{ display: 'flex', gap: '6px', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '90%' }}>
                          <div style={{ fontSize: '9px', color: 'var(--muted-foreground)', marginBottom: '2px', fontFamily: "'Share Tech Mono', monospace" }}>
                            {msg.sender === 'assistant' ? 'ATHENA' : 'OPERATOR'} · {msg.timestamp}
                          </div>
                          <div 
                            style={{ 
                              background: msg.sender === 'user' ? 'rgba(0, 229, 255, 0.08)' : 'var(--cp-bg-3)',
                              border: msg.sender === 'user' ? '1px solid rgba(0, 229, 255, 0.2)' : '1px solid var(--cp-border)',
                              padding: '8px 10px',
                              borderRadius: '2px',
                              fontSize: '12px',
                              color: 'var(--foreground)',
                              lineHeight: '1.4',
                              wordBreak: 'break-word'
                            }}
                          >
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                              <div style={{ minWidth: 0, flex: 1 }}>{msg.text}</div>
                              {msg.sender === 'assistant' && msg.id !== 'init' && (
                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyAthenaMessage(msg.text)}
                                    title="Copy response"
                                    aria-label="Copy response"
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid var(--cp-border)',
                                      color: 'var(--cp-cyan)',
                                      padding: '2px 4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Copy size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAthenaMessage(msg.id)}
                                    title="Delete response"
                                    aria-label="Delete response"
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid rgba(255, 34, 68, 0.45)',
                                      color: 'var(--cp-magenta)',
                                      padding: '2px 4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isAiLoading && (
                      <div style={{ color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Loader size={10} className="animate-spin" /> deliberation...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat input box */}
                  <form onSubmit={handleSendAthenaMessage} style={{ marginTop: '8px', display: 'flex', border: '1px solid var(--cp-border)' }}>
                    <input 
                      type="text"
                      placeholder="ask athena..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      disabled={isAiLoading}
                      style={{
                        flex: 1,
                        background: 'var(--cp-bg-3)',
                        border: 0,
                        color: 'var(--foreground)',
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontFamily: "'Share Tech Mono', monospace",
                        outline: 'none'
                      }}
                    />
                    <button 
                      type="submit"
                      disabled={isAiLoading}
                      style={{
                        background: 'var(--cp-cyan)',
                        color: 'var(--cp-bg-0)',
                        border: 0,
                        padding: '0 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Send size={11} />
                    </button>
                  </form>
                </div>
              )}
              {rightPanelTab === 'prd-inspector' && (
                selectedPrd ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
                        PRD DOCUMENT INSPECTOR
                      </span>
                      {selectedPrd.status === 'draft' ? (
                        <button 
                          onClick={() => handlePushToConfluence(selectedPrd.id)}
                          style={{
                            background: 'rgba(0, 229, 255, 0.1)',
                            border: '1px solid var(--cp-cyan)',
                            color: 'var(--cp-cyan)',
                            fontSize: '10px',
                            fontFamily: "'Share Tech Mono', monospace",
                            padding: '2px 6px'
                          }}
                        >
                          PUSH TO CONFLUENCE
                        </button>
                      ) : (
                        <span style={{ color: 'var(--cp-green)', fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Check size={12} /> CONFLUENCE OK
                        </span>
                      )}
                    </div>

                    <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '10px' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '14px' }}>{selectedPrd.title}</h3>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '8px' }}>
                        Last updated: {new Date(selectedPrd.lastUpdated).toLocaleDateString()}
                      </div>
                      {selectedPrd.confluenceUrl && (
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); alert(`Opening wiki link: ${selectedPrd.confluenceUrl}`) }}
                          style={{ color: 'var(--cp-cyan)', fontSize: '11px', textDecoration: 'underline', display: 'block', marginBottom: '8px' }}
                        >
                          Confluence Space URL
                        </a>
                      )}
                      <pre style={{ margin: 0, fontSize: '11px', color: 'var(--foreground)', background: 'var(--cp-bg-3)', padding: '6px', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
                        {selectedPrd.content}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', opacity: 0.3, textAlign: 'center', padding: '40px 10px' }}>
                    <Info size={24} style={{ marginBottom: '8px', color: 'var(--cp-cyan)' }} />
                    <span style={{ fontSize: '12px' }}>
                      Select a Confluence PRD from the registry sidebar to inspect details and requirements.
                    </span>
                  </div>
                )
              )}

              {rightPanelTab === 'confluence' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
                    CONFLUENCE SITE STATUS
                  </span>
                  <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div>Wiki Domain: <strong>savant-space.atlassian.net</strong></div>
                    <div>Default Project Key: <strong>FORGE</strong></div>
                    <div>Connection: <span style={{ color: 'var(--cp-green)' }}>ESTABLISHED</span></div>
                    <div style={{ color: 'var(--muted-foreground)', fontSize: '11px', marginTop: '6px' }}>
                      Confluence is linked with Athena PM gateway for automatic page publishes of signed PRDs.
                    </div>
                  </div>
                </div>
              )}

              {rightPanelTab === 'athena-logs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
                    ATHENA COGNITIVE TELEMETRY
                  </span>
                  <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>Active Gateway: <strong>http://127.0.0.1:3100</strong></div>
                    <div>Active Provider: <strong>{config?.athena_provider || 'codex'}</strong></div>
                    <div>Active Model: <strong>{config?.athena_model || 'gpt-5-codex'}</strong></div>
                    <div>Active Workspace ID: <strong style={{ color: 'var(--cp-cyan)' }}>17807589009121862532574</strong></div>
                    <hr style={{ borderColor: 'var(--cp-border)', margin: '4px 0' }} />
                    <div style={{ color: 'var(--cp-green)' }}>✓ MCP tool abilities successfully loaded.</div>
                    <div style={{ color: 'var(--cp-green)' }}>✓ DB connection state active.</div>
                  </div>
                </div>
              )}

              {rightPanelTab === 'dev-inspector' && (
                selectedDeveloper ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                      <div>
                      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                        DEVELOPER PROFILE
                      </span>
                      <h3 style={{ margin: '4px 0', fontSize: '16px', color: 'var(--foreground)' }}>
                        {selectedDeveloper.name}
                      </h3>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                        <StatusBadge label={selectedDevStats?.workloadLabel || 'FREE'} />
                        <StatusBadge label={selectedDeveloper.region.toUpperCase()} />
                        <StatusBadge label={selectedDeveloper.timezone} />
                      </div>
                      <SpecialtyTagPills tags={selectedDeveloperSpecialties} style={{ marginTop: '8px' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => openEditDeveloperModal(selectedDeveloper)}
                          style={railActionButtonStyle}
                        >
                          <Save size={12} />
                          Edit person
                        </button>
                      </div>
                    </div>

                    <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '10px', fontSize: '12px', display: 'grid', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                        <StatTile label="Ranking" value={selectedDeveloper.ranking.toUpperCase()} tone="cyan" />
                        <StatTile label="Specialty" value={describeSpecialties(selectedDeveloperSpecialties)} tone="muted" />
                        <StatTile label="Raw Capacity" value={`${selectedDeveloper.raw_capacity} SP`} tone="yellow" />
                        <StatTile label="Buffer Cap" value={`${(selectedDeveloper.raw_capacity * 0.8).toFixed(0)} SP`} tone="green" />
                        <StatTile label="Assigned" value={`${selectedDevStats?.totalPoints || 0} SP`} tone="cyan" />
                        <StatTile label="Delivered" value={`${selectedDevStats?.assignedTickets.filter((ticket) => ticket.status === 'done').reduce((acc, ticket) => acc + ticket.story_points, 0) || 0} SP`} tone="green" />
                        <StatTile label="Open" value={`${selectedDevStats?.assignedTickets.filter((ticket) => ticket.status !== 'done').reduce((acc, ticket) => acc + ticket.story_points, 0) || 0} SP`} tone="yellow" />
                        <StatTile label="Overdue" value={`${Math.max(0, (selectedDevStats?.assignedTickets.filter((ticket) => ticket.status !== 'done').reduce((acc, ticket) => acc + ticket.story_points, 0) || 0) - (selectedDevStats?.effectiveCapacity || selectedDeveloper.raw_capacity * 0.8))} SP`} tone="destructive" />
                      </div>

                      <div style={{ display: 'grid', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace" }}>
                          <span style={{ color: 'var(--muted-foreground)' }}>Utilization</span>
                          <strong style={{ color: 'var(--cp-cyan)' }}>{Math.round((selectedDevStats?.ratio || 0) * 100)}%</strong>
                        </div>
                        <div style={{ height: '8px', background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.round((selectedDevStats?.ratio || 0) * 100))}%`,
                              height: '100%',
                              background: (selectedDevStats?.isOverload || false)
                                ? 'linear-gradient(90deg, #ff2244, #ff8800)'
                                : 'linear-gradient(90deg, #00ff88, #00e5ff)'
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                        <StatTile label="Availability" value={`${Math.round((selectedDevStats?.availabilityRatio ?? 1) * 100)}%`} tone="green" />
                        <StatTile label="Work Days" value={(selectedDeveloper.working_days || []).map((day) => day.slice(0, 3)).join(', ')} tone="muted" />
                        <StatTile label="Time Off" value={`${selectedDevStats?.personalTimeOff || 0} events`} tone="yellow" />
                        <StatTile label="Company Holidays" value={`${selectedDevStats?.companyHolidays || 0} days`} tone="yellow" />
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '6px' }}>
                        // ASSIGNED WORKLOAD ({selectedDevStats?.assignedTickets.length || 0})
                      </div>
                      <MiniJiraBoard
                        tickets={selectedDevStats?.assignedTickets || []}
                        onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', opacity: 0.3, textAlign: 'center', padding: '40px 10px' }}>
                    <UserRound size={24} style={{ marginBottom: '8px', color: 'var(--cp-cyan)' }} />
                    <span style={{ fontSize: '12px' }}>
                      Select a developer card in the squads cockpit to inspect workload metrics.
                    </span>
                  </div>
                )
              )}

              {rightPanelTab === 'squad-stats' && (
                <SquadStatsPanel history={squadStatsHistory} latest={latestSquadSnapshot} />
              )}

              {rightPanelTab === 'sprint-current' && (
                <SprintWorkbenchPanel
                  mode="current"
                  activeSquad={activeSquad}
                  history={squadStatsHistory}
                  latest={latestSquadSnapshot}
                  sprintPlans={sprintPlans}
                  currentSprint={currentSprint}
                  availabilityEvents={availabilityEvents}
                  tickets={tickets}
                  onCreateSprint={handleCreateSprint}
                  onSetCurrentSprint={handleSetCurrentSprint}
                  onCompleteSprint={handleCompleteSprint}
                  onAddAvailabilityEvent={handleAddAvailabilityEvent}
                />
              )}



              {rightPanelTab === 'sprint-past' && (
                <SprintWorkbenchPanel
                  mode="past"
                  activeSquad={activeSquad}
                  history={squadStatsHistory}
                  latest={latestSquadSnapshot}
                  sprintPlans={sprintPlans}
                  currentSprint={currentSprint}
                  availabilityEvents={availabilityEvents}
                  tickets={tickets}
                  onCreateSprint={handleCreateSprint}
                  onSetCurrentSprint={handleSetCurrentSprint}
                  onCompleteSprint={handleCompleteSprint}
                  onAddAvailabilityEvent={handleAddAvailabilityEvent}
                />
              )}

              {rightPanelTab === 'ticket-inspector' && (
                selectedTicket ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", fontWeight: 'bold', fontSize: '14px' }}>
                          {selectedTicket.ticket_key}
                        </span>
                        <button 
                          onClick={() => unassignTicket(selectedTicket.ticket_id)}
                          disabled={!selectedTicket.assignee}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 34, 68, 0.4)',
                            color: '#ff2244',
                            fontSize: '9px',
                            fontFamily: "'Share Tech Mono', monospace",
                            padding: '1px 4px',
                            opacity: selectedTicket.assignee ? 1 : 0.3
                          }}
                        >
                          UNASSIGN
                        </button>
                      </div>
                      <h3 style={{ margin: '4px 0', fontSize: '15px', color: 'var(--foreground)' }}>
                        {selectedTicket.title.replace(/\[SP-\d+\]\s*/i, '')}
                      </h3>
                    </div>

                    <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '10px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-foreground)' }}>Status:</span>
                        <select
                          value={selectedTicket.status}
                          onChange={async (e) => {
                            const updated = { ...selectedTicket, status: e.target.value }
                            setTickets(prev => prev.map(t => t.ticket_id === selectedTicket.ticket_id ? updated : t))
                            await updateTicketLocal(runtime.serverUrl, updated)
                          }}
                          style={{ background: 'var(--cp-bg-3)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', outline: 'none' }}
                        >
                          <option value="todo">TODO</option>
                          <option value="in_progress">IN PROGRESS</option>
                          <option value="done">DONE</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-foreground)' }}>Story Points:</span>
                        <select
                          value={selectedTicket.story_points}
                          onChange={async (e) => {
                            const updated = { ...selectedTicket, story_points: parseInt(e.target.value) }
                            setTickets(prev => prev.map(t => t.ticket_id === selectedTicket.ticket_id ? updated : t))
                            await updateTicketLocal(runtime.serverUrl, updated)
                          }}
                          style={{ background: 'var(--cp-bg-3)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', outline: 'none', fontSize: '11px' }}
                        >
                          <option value="1">1 SP</option>
                          <option value="2">2 SP</option>
                          <option value="3">3 SP</option>
                          <option value="5">5 SP</option>
                          <option value="8">8 SP</option>
                          <option value="13">13 SP</option>
                          <option value="21">21 SP</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-foreground)' }}>Assignee ID:</span>
                        <strong style={{ color: selectedTicket.assignee ? 'var(--cp-cyan)' : 'var(--cp-yellow)' }}>
                          {selectedTicket.assignee || 'Unassigned'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-foreground)' }}>Sprint Link:</span>
                        <select
                          value={selectedTicket.sprint_id || ''}
                          onChange={async (e) => {
                            const updated = { ...selectedTicket, sprint_id: e.target.value || undefined }
                            setTickets(prev => prev.map(t => t.ticket_id === selectedTicket.ticket_id ? updated : t))
                            await updateTicketLocal(runtime.serverUrl, updated)
                          }}
                          style={{ background: 'var(--cp-bg-3)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', outline: 'none', fontSize: '11px', maxWidth: '140px' }}
                        >
                          <option value="">None (Backlog)</option>
                          {sprintPlans.map(plan => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} ({plan.status.toUpperCase()})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-foreground)' }}>Reporter:</span>
                        <span>{selectedTicket.reporter}</span>
                      </div>
                    </div>

                    {selectedTicket.assignee && (
                      <div style={{ background: 'rgba(0, 229, 255, 0.04)', border: '1px solid rgba(0, 229, 255, 0.1)', padding: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '4px' }}>
                          // ASSIGNED OWNER METRICS
                        </div>
                        {(() => {
                          const ownerStats = devLoadStats.find(s => s.dev.id === selectedTicket.assignee)
                          if (!ownerStats) return null
                          return (
                            <div style={{ fontSize: '12px' }}>
                              <div>Owner: <strong>{ownerStats.dev.name}</strong></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                <span>Sprint Allocation:</span>
                                <span style={{ color: ownerStats.isOverload ? 'var(--cp-magenta)' : 'var(--cp-green)' }}>
                                  {ownerStats.totalPoints} / {ownerStats.effectiveCapacity.toFixed(0)} SP
                                </span>
                              </div>
                              {ownerStats.isOverload && (
                                <div style={{ color: 'var(--cp-magenta)', fontSize: '11px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <AlertTriangle size={12} /> Exceeds safety threshold!
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', opacity: 0.3, textAlign: 'center', padding: '40px 10px' }}>
                    <Info size={24} style={{ marginBottom: '8px', color: 'var(--cp-cyan)' }} />
                    <span style={{ fontSize: '12px' }}>
                      Select a blueprint ticket in the list or table registry to inspect detail variables.
                    </span>
                  </div>
                )
              )}

              {rightPanelTab === 'create-ticket' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
                    QUICK INGEST NEW BLUEPRINT
                  </span>
                  <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--cp-bg-2)', padding: '10px', border: '1px solid var(--cp-border)' }}>
                    <input 
                      type="text" 
                      placeholder="Key (e.g. FORGE-102)"
                      value={newTicketKey}
                      onChange={(e) => setNewTicketKey(e.target.value)}
                      required
                      style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--foreground)', padding: '6px', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace", outline: 'none' }}
                    />
                    <input 
                      type="text" 
                      placeholder="Title..." 
                      value={newTicketTitle}
                      onChange={(e) => setNewTicketTitle(e.target.value)}
                      required
                      style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--foreground)', padding: '6px', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace", outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input 
                        type="number" 
                        min="0"
                        max="100"
                        placeholder="SP"
                        value={newTicketSp}
                        onChange={(e) => setNewTicketSp(e.target.value)}
                        style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--foreground)', padding: '6px', fontSize: '11px', width: '60px', fontFamily: "'Share Tech Mono', monospace", outline: 'none' }}
                      />
                      <select
                        value={newTicketPriority}
                        onChange={(e) => setNewTicketPriority(e.target.value)}
                        style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--cp-cyan)', padding: '6px', fontSize: '11px', flex: 1, fontFamily: "'Share Tech Mono', monospace", outline: 'none' }}
                      >
                        <option value="low">LOW</option>
                        <option value="medium">MEDIUM</option>
                        <option value="high">HIGH</option>
                      </select>
                    </div>
                    <button type="submit" style={{ background: 'rgba(0, 229, 255, 0.1)', border: '1px solid var(--cp-cyan)', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', padding: '6px', marginTop: '6px', fontWeight: 'bold' }}>
                      + Forge Ticket
                    </button>
                  </form>
                </div>
              )}

              {rightPanelTab === 'threshold-config' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
                    SAFETY BUFFER CONTROLLER
                  </span>
                  <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Capability Threshold Percentage</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="range" 
                        min="50" 
                        max="100" 
                        value={(config?.buffer_threshold || 0.8) * 100}
                        onChange={(e) => {
                          if (config) {
                            const updated = { ...config, buffer_threshold: parseInt(e.target.value) / 100 }
                            setConfig(updated)
                            saveForgeConfig(updated)
                          }
                        }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--cp-green)', fontSize: '14px', fontWeight: 'bold' }}>
                        {((config?.buffer_threshold || 0.8) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {rightPanelTab === 'health-status' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
                    SYSTEM CONNECTION GATEWAYS
                  </span>
                  <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>Environment: <strong style={{ color: 'var(--cp-yellow)' }}>{runtime.theme.toUpperCase()}</strong></div>
                    <div>Server URL: <strong>{serverUrl}</strong></div>
                    <div>Gateway Link: <strong>{gatewayUrl}</strong></div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Right Sidebar Rail */}
        <aside className="icon-rail rail-right" style={{ background: 'var(--cp-bg-1)', borderLeft: '1px solid var(--cp-border)', borderRight: '0' }}>
          <div className="rail-top">
            {/* Ask Athena - Always available on the right rail */}
            <button 
              className={`nav-icon ${rightPanelOpen && rightPanelTab === 'athena-chat' ? 'active' : ''}`}
              onClick={() => handleRightRailClick('athena-chat')}
              title="athena chat"
              style={{ marginBottom: '12px', borderBottom: '1px solid var(--cp-border)', width: '40px', height: '40px' }}
            >
              <Sparkles size={16} />
              <span className="rail-label-text">athena chat</span>
            </button>

            {activeTab === 'projects' && (
              <>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'prd-inspector' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('prd-inspector')}
                  title="PRD Document Inspector"
                >
                  <FileText size={16} />
                </button>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'confluence' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('confluence')}
                  title="Confluence Space Gateway"
                >
                  <Globe size={16} />
                </button>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'athena-logs' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('athena-logs')}
                  title="Athena Code Context"
                >
                  <Search size={16} />
                </button>
              </>
            )}
            
            {activeTab === 'squad' && (
              <>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'dev-inspector' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('dev-inspector')}
                  title="Developer Workload Profile"
                >
                  <UserRound size={16} />
                </button>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'squad-stats' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('squad-stats')}
                  title="Squad Capability Analytics"
                >
                  <TrendingUp size={16} />
                </button>
                <button
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'sprint-current' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('sprint-current')}
                  title="Current Sprint Details"
                >
                  <Zap size={16} />
                </button>
                <button
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'sprint-past' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('sprint-past')}
                  title="Past Sprints & Reports"
                >
                  <History size={16} />
                </button>
              </>
            )}
            
            {activeTab === 'blueprint' && (
              <>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'ticket-inspector' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('ticket-inspector')}
                  title="Jira Ticket Details"
                >
                  <Info size={16} />
                </button>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'create-ticket' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('create-ticket')}
                  title="Quick Ingest Blueprint Form"
                >
                  <Plus size={16} />
                </button>
              </>
            )}
            
            {activeTab === 'settings' && (
              <>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'threshold-config' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('threshold-config')}
                  title="Safety Buffer Control"
                >
                  <Sliders size={16} />
                </button>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'health-status' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('health-status')}
                  title="System Connection Endpoints"
                >
                  <CircleDot size={16} />
                </button>
              </>
            )}
          </div>
          
          <div className="rail-bottom">
            <button 
              className="nav-icon"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              title={rightPanelOpen ? "Collapse Right Panel" : "Expand Right Panel"}
            >
              {rightPanelOpen ? (
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* Footer System Status Bar */}
      <footer className="bottom-bar">
        <StatusSegment label="operator" value={profile?.name || 'guest'} status={profile ? 'online' : 'warning'} />
        <StatusSegment label="server" value={serverUrl} status={serverHealth.status === 'online' ? 'online' : 'offline'} />
        <StatusSegment label="gateway" value={gatewayUrl} status={gatewayHealth.status === 'online' ? 'online' : 'offline'} />
        <StatusSegment label="app" value={`${runtime.appName} v${runtime.appVersion}`} status="online" />
        <PromptTracker
          gatewayUrl={gatewayUrl}
          profileName={profile?.name || 'guest'}
          tickets={tickets}
          prds={prds}
          squads={config?.squads || []}
        />
        <div className="bottom-clock">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
      </footer>

      {/* Settings Modal Overlay */}
      <SettingsModal
        isOpen={isSettingsOpen}
        config={config}
        onConfigChange={(updated) => {
          setConfig(updated)
          saveForgeConfig(updated)
        }}
        onClose={() => setIsSettingsOpen(false)}
        theme={runtime.theme}
        serverUrl={serverUrl}
        gatewayUrl={gatewayUrl}
        onServerUrlChange={(url) => {
          setServerUrl(url)
          localStorage.setItem('savant_server_url', url)
        }}
        onGatewayUrlChange={(url) => {
          setGatewayUrl(url)
          localStorage.setItem('savant_gateway_url', url)
        }}
        providers={gatewayProviders}
        profile={profile}
        onProfileChange={(updated) => {
          setProfile(updated)
        }}
      />

      {/* Logout Confirmation Modal Overlay */}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onConfirm={handleLogout}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />
      <DeveloperModal
        isOpen={isDeveloperModalOpen}
        mode={developerModalMode}
        draft={developerDraft}
        onChange={setDeveloperDraft}
        onSubmit={handleSaveDeveloper}
        onClose={() => setIsDeveloperModalOpen(false)}
        activeSquadName={activeSquad?.name}
        squadOptions={config?.squads || []}
        regions={Object.keys(config?.company_holidays_by_region || {})}
      />
      {/* Login Modal Overlay */}
      {!profile && (
        <LoginScreen onLogin={handleLoginWithKey} />
      )}
    </div>
  )
}

function StatusSegment({ label, value, status }: { label: string; value: string; status: 'online' | 'offline' | 'warning' }) {
  return (
    <div className="status-segment">
      <span className={`status-dot ${status}`} />
      <span className="status-label">{label}:</span>
      <span className={`status-value ${status}`}>{value}</span>
    </div>
  )
}

function ConnectionPill({ label, health }: { label: string; health: HealthState }) {
  return (
    <button className={`connection-pill ${health.status}`} title={health.detail}>
      <CircleDot size={9} />
      {label}
    </button>
  )
}

function StatusBadge({ label }: { label: string }) {
  const tone = label === 'OVERWORKED'
    ? { color: 'var(--cp-magenta)', background: 'rgba(255, 34, 68, 0.08)' }
    : label === 'NORMAL'
    ? { color: 'var(--cp-yellow)', background: 'rgba(255, 230, 0, 0.06)' }
    : label === 'HAPPY' || label === 'FREE'
    ? { color: 'var(--cp-green)', background: 'rgba(0, 255, 136, 0.06)' }
    : { color: 'var(--cp-cyan)', background: 'rgba(0, 229, 255, 0.06)' }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 6px',
      border: '1px solid var(--cp-border)',
      color: tone.color,
      background: tone.background,
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '9px',
      fontWeight: 'bold'
    }}>
      {label}
    </span>
  )
}

function StatTile({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone: 'cyan' | 'green' | 'yellow' | 'destructive' | 'muted'
}) {
  const color =
    tone === 'cyan' ? 'var(--cp-cyan)' :
    tone === 'green' ? 'var(--cp-green)' :
    tone === 'yellow' ? 'var(--cp-yellow)' :
    tone === 'destructive' ? 'var(--cp-magenta)' :
    'var(--muted-foreground)'

  return (
    <div style={{ border: '1px solid var(--cp-border)', background: 'var(--cp-bg-3)', padding: '8px' }}>
      <div style={{ fontSize: '9px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ marginTop: '3px', color, fontSize: '12px', fontWeight: 'bold' }}>
        {value}
      </div>
    </div>
  )
}

function MiniJiraBoard({
  tickets,
  onSelectTicket
}: {
  tickets: JiraTicket[]
  onSelectTicket: (ticketId: string) => void
}) {
  const epics = groupDeveloperTicketsByEpic(tickets)

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {epics.length ? epics.map((epic) => (
        <section
          key={epic.epicKey}
          style={{
            border: '1px solid var(--cp-border)',
            background: 'var(--cp-bg-2)',
            padding: '8px',
            display: 'grid',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>
            <span style={{ color: 'var(--cp-cyan)' }}>{epic.epicTitle}</span>
            <span style={{ color: 'var(--muted-foreground)' }}>{epic.items.todo.length + epic.items.inprogress.length + epic.items.done.length} issues</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
            <MiniJiraColumn label="Todo" tone="muted" tickets={epic.items.todo} onSelectTicket={onSelectTicket} />
            <MiniJiraColumn label="In Progress" tone="warning" tickets={epic.items.inprogress} onSelectTicket={onSelectTicket} />
            <MiniJiraColumn label="Done" tone="good" tickets={epic.items.done} onSelectTicket={onSelectTicket} />
          </div>
        </section>
      )) : (
        <div style={{ border: '1px solid var(--cp-border)', background: 'var(--cp-bg-2)', padding: '8px', fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
          No assigned Jira tickets.
        </div>
      )}
    </div>
  )
}

function MiniJiraColumn({
  label,
  tone,
  tickets,
  onSelectTicket
}: {
  label: string
  tone: 'muted' | 'warning' | 'good'
  tickets: JiraTicket[]
  onSelectTicket: (ticketId: string) => void
}) {
  const color = tone === 'warning' ? 'var(--cp-yellow)' : tone === 'good' ? 'var(--cp-green)' : 'var(--muted-foreground)'
  const bg = tone === 'warning' ? 'rgba(255, 230, 0, 0.05)' : tone === 'good' ? 'rgba(0, 255, 136, 0.05)' : 'rgba(255, 255, 255, 0.03)'

  return (
    <div style={{ border: '1px solid var(--cp-border)', background: bg, padding: '6px', minHeight: '70px', display: 'grid', gap: '6px' }}>
      <div style={{ fontSize: '9px', color, fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'grid', gap: '4px' }}>
        {tickets.length ? tickets.map((ticket) => (
          <button
            key={ticket.ticket_id}
            type="button"
            onClick={() => onSelectTicket(ticket.ticket_id)}
            style={{
              textAlign: 'left',
              border: '1px solid var(--cp-border)',
              background: 'var(--cp-bg-3)',
              color: 'var(--foreground)',
              padding: '5px 6px',
              fontSize: '10px',
              fontFamily: "'Share Tech Mono', monospace",
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '6px'
            }}
          >
            <span style={{ color: 'var(--cp-cyan)' }}>{ticket.ticket_key}</span>
            <span>{ticket.story_points} SP</span>
          </button>
        )) : (
          <div style={{ fontSize: '9px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", opacity: 0.8 }}>
            Empty
          </div>
        )}
      </div>
    </div>
  )
}

const railActionButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  border: '1px solid var(--cp-border)',
  background: 'rgba(0, 229, 255, 0.08)',
  color: 'var(--cp-cyan)',
  padding: '6px 8px',
  fontSize: '10px',
  fontFamily: "'Share Tech Mono', monospace",
  textTransform: 'uppercase',
  cursor: 'pointer'
}

function PromptTracker({
  gatewayUrl,
  tickets,
  prds,
  squads
}: {
  gatewayUrl: string
  profileName: string
  tickets: JiraTicket[]
  prds: PRDDocument[]
  squads: Squad[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [runs, setRuns] = useState<AthenaRunRecord[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedRunEvents, setSelectedRunEvents] = useState<AthenaRunRecord | null>(null)
  const [isPollingEvents, setIsPollingEvents] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const allowedIds = useMemo(() => new Set([
    FORGE_WORKSPACE_ID,
    'savant-forge',
    'forge',
    ...tickets.flatMap((ticket) => [ticket.ticket_id, ticket.ticket_key].filter(Boolean)),
    ...prds.map((prd) => prd.id),
    ...squads.map((squad) => squad.id)
  ]), [tickets, prds, squads])

  const filteredRuns = useMemo(() => runs.filter((run: any) => {
    const metadata = run.metadata || {}
    const appName = String(run.app || metadata.app || metadata.appName || '').toLowerCase()
    const workspaceId = String(run.workspace_id || run.workspaceId || metadata.workspace_id || metadata.workspaceId || '')
    return appName.includes('forge') || allowedIds.has(workspaceId)
  }), [runs, allowedIds])

  const activeRunsCount = useMemo(
    () => filteredRuns.filter((run) => run.status === 'running').length,
    [filteredRuns]
  )

  const selectedRun = filteredRuns.find((run) => run.id === selectedRunId)

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedRunEvents])

  useEffect(() => {
    function refreshRuns() {
      setRuns(loadAthenaRuns())
    }
    refreshRuns()
    window.addEventListener('savant-forge-prompt-runs-changed', refreshRuns as EventListener)
    window.addEventListener('storage', refreshRuns)
    const interval = window.setInterval(refreshRuns, 1500)
    return () => {
      window.removeEventListener('savant-forge-prompt-runs-changed', refreshRuns as EventListener)
      window.removeEventListener('storage', refreshRuns)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !selectedRunId) {
      setSelectedRunEvents(null)
      return
    }

    function refreshSelectedRun() {
      setIsPollingEvents(true)
      const selected = loadAthenaRuns().find((run) => run.id === selectedRunId) || null
      setSelectedRunEvents(selected)
      setIsPollingEvents(false)
    }

    refreshSelectedRun()
    window.addEventListener('savant-forge-prompt-runs-changed', refreshSelectedRun as EventListener)
    const interval = window.setInterval(refreshSelectedRun, 1000)
    return () => {
      window.removeEventListener('savant-forge-prompt-runs-changed', refreshSelectedRun as EventListener)
      window.clearInterval(interval)
    }
  }, [isOpen, selectedRunId])

  async function handleKillRun(runId: string) {
    try {
      const headers: Record<string, string> = {}
      const response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/runs/${runId}`, {
        method: 'DELETE',
        headers
      })
      if (response.ok) {
        updateAthenaRun(runId, (run) => ({ ...run, status: 'error', endedAt: new Date().toISOString() }))
      }
    } catch {
      updateAthenaRun(runId, (run) => ({ ...run, status: 'error', endedAt: new Date().toISOString() }))
    }
  }

  function openTracker() {
    setIsOpen(prev => {
      const next = !prev
      if (next && filteredRuns.length > 0 && !selectedRunId) {
        setSelectedRunId(filteredRuns[0].id)
      }
      return next
    })
  }

  return (
    <>
      <button
        className={`prompt-tracker-button ${activeRunsCount > 0 ? 'active' : isOpen ? 'open' : ''}`}
        onClick={openTracker}
        title="Prompt Tracker"
      >
        <Activity size={12} className={activeRunsCount > 0 ? 'animate-spin' : ''} />
        <span>PROMPT TRACKER: {activeRunsCount > 0 ? `${activeRunsCount} ACTIVE` : 'IDLE'}</span>
      </button>

      {isOpen && (
        <div className="prompt-tracker-panel">
          <div className="prompt-tracker-head">
            <div className="prompt-tracker-title">
              <Terminal size={14} />
              <span>// FORGE PROMPT TRACKER</span>
            </div>
            <button onClick={() => setIsOpen(false)} title="Close prompt tracker" aria-label="Close prompt tracker">
              <X size={14} />
            </button>
          </div>

          <div className="prompt-tracker-body">
            <div className="prompt-run-list">
              <div className="prompt-pane-label">Run Registry</div>
              <div className="prompt-run-scroll">
                {filteredRuns.length === 0 ? (
                  <div className="prompt-empty">No Forge runs captured</div>
                ) : filteredRuns.map((run: any) => {
                  const isActive = selectedRunId === run.id
                  const started = run.startedAt || run.started_at || run.createdAt || Date.now()
                  const dateText = new Date(started).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  return (
                    <button
                      key={run.id}
                      className={`prompt-run-row ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <div>
                        <strong>{run.provider && run.model ? `${run.provider}:${run.model}` : 'Forge Run'}</strong>
                        <span>{dateText}</span>
                      </div>
                      <em className={`prompt-status prompt-status-${run.status || 'unknown'}`}>{run.status || 'unknown'}</em>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="prompt-event-pane">
              {selectedRunId ? (
                <div className="prompt-event-content">
                  <div className="prompt-event-summary">
                    <div>
                      <strong>ID: {selectedRunId}</strong>
                      <span>Status: {selectedRun?.status || 'unknown'}</span>
                    </div>
                    {selectedRun?.status === 'running' && (
                      <button onClick={() => handleKillRun(selectedRunId)}>
                        <StopCircle size={11} />
                        TERMINATE
                      </button>
                    )}
                  </div>

                  <div className="prompt-terminal">
                    <div className="prompt-terminal-head">
                      <span>// execution event log</span>
                      {isPollingEvents && <span>polling...</span>}
                    </div>

                    {selectedRunEvents?.events?.map((event: any, index: number) => {
                      if (event.type === 'thinking') {
                        return (
                          <div key={index} className={event.status === 'error' ? 'prompt-line-error' : 'prompt-line-thinking'}>
                            &gt; Thinking [{event.provider}:{event.model}] ({event.status}){event.reason ? ` - ${event.reason}` : ''}
                          </div>
                        )
                      }
                      if (event.type === 'chunk') {
                        return <div key={index} className="prompt-line-chunk">{event.content}</div>
                      }
                      if (event.type === 'complete') {
                        return <div key={index} className="prompt-line-complete">&gt; Run completed successfully.</div>
                      }
                      if (event.type === 'error') {
                        return <div key={index} className="prompt-line-error">&gt; Error: {event.message || event.content || 'Run failed'}</div>
                      }
                      return <div key={index} className="prompt-line-muted">{JSON.stringify(event)}</div>
                    })}

                    {selectedRun?.status === 'running' && (
                      <div className="prompt-line-running">
                        <RefreshCcw size={10} className="animate-spin" />
                        <span>[AGENT DELIBERATION IN PROGRESS] Awaiting next tool execution or response chunk...</span>
                      </div>
                    )}

                    {(!selectedRunEvents?.events || selectedRunEvents.events.length === 0) && (
                      <div className="prompt-empty">Initializing run and awaiting execution stream...</div>
                    )}
                    <div ref={logEndRef} />
                  </div>
                </div>
              ) : (
                <div className="prompt-empty prompt-empty-centered">
                  <Terminal size={32} />
                  <span>Select a run from the registry list to inspect execution events</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
