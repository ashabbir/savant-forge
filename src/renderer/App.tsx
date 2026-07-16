import { useState, useEffect, FormEvent, useRef, useMemo, useCallback, type CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  Edit,
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
  ChevronLeft,
  ChevronRight,
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
  Tag,
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
  deleteTicketLocal,
  pushToConfluence,
  loadPRDsFromServer,
  syncPRDsToServer,
  type ForgeConfig,
  type ProjectEntity,
  type FeatureRequest,
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
  deleteAvailabilityEvent,
  getProjectEntities,
  saveProjectEntity,
  setCurrentProjectEntity,
  getCurrentProjectEntity,
  getFeatureRequests,
  saveFeatureRequest,
  deleteFeatureRequest
} from './services/localState'

import {
  buildAthenaPromptSections,
  fetchAthenaCodeContext,
  fetchAthenaMcpTools,
  formatAthenaContextHits,
  resolveAthenaPersona
} from './services/athenaContext'
import {
  appendAthenaThreadMessage,
  deleteAthenaThreadMessage,
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
  updateAthenaRun,
  deleteAthenaThread
} from './services/athenaStore'

import { createStructuredPrd, generateOneLineEpic, decomposeEpicIntoTickets, finalizePlanningSummary, syncFinalizedPlanSummary } from './services/planningWorkflow'

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
import { AddTicketModal } from './components/AddTicketModal'
import { ProductManagerPanel } from './components/ProductManagerPanel'
import { PeopleManagementPanel } from './components/PeopleManagementPanel'
import { TeamsManagementPanel } from './components/TeamsManagementPanel'

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
const LEFT_COLLAPSIBLE_LABELS: Record<'squad' | 'projects' | 'blueprint' | 'settings', string> = {
  squad: 'SQUAD',
  projects: 'PROJECTS',
  blueprint: 'BLUEPRINTS',
  settings: 'SETTINGS'
}

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
  selectedProject: ProjectEntity | undefined
  config: ForgeConfig | null
}) {
  const { activeTab, activeSquad, selectedDeveloper, selectedTicket, selectedPrd, selectedProject, config } = params
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

  if (selectedProject) {
    return {
      kind: 'project' as const,
      key: `project:${selectedProject.id}`,
      title: `Project: ${selectedProject.name}`,
      summary: 'Project planning context for Athena across project goals, features, PRDs, and delivery state.',
      promptSections: [
        ['CONTEXT MODE', 'Project planning'],
        ['TARGET ENTITY', `project_id=${selectedProject.id}\nname=${selectedProject.name}`],
        ['PROJECT GOALS', selectedProject.goals || ''],
        ['PROJECT FUNCTIONALITIES', selectedProject.functionalities || '']
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

type AthenaContextOverride = {
  kind: AthenaContextKind
  key: string
  title: string
  summary: string
  promptSections: [string, string][]
} | null

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
  
  const renderAthenaRunEvent = (ev: any, idx: number) => {
    if (ev.type === 'thinking') {
      return (
        <div key={idx} className="run-event run-event-thinking">
          &gt; [{ev.provider || 'codex'}] {ev.status || 'deliberating'}{ev.reason ? ` — ${ev.reason}` : ''}
          {ev.status === 'running' && <span className="running-dots">...</span>}
        </div>
      )
    }
    if (ev.type === 'call') {
      return (
        <div key={idx} className="run-event run-event-call">
          🔧 Calling tool: <span className="tool-name">{ev.name || 'unknown'}</span>
          {ev.arguments && (
            <pre className="tool-args">{typeof ev.arguments === 'string' ? ev.arguments : JSON.stringify(ev.arguments, null, 2)}</pre>
          )}
        </div>
      )
    }
    if (ev.type === 'response') {
      return (
        <div key={idx} className="run-event run-event-response">
          ✅ Tool response from: <span className="tool-name">{ev.name || 'unknown'}</span>
          {ev.content && (
            <pre className="tool-response-content">
              {typeof ev.content === 'string' 
                ? (ev.content.length > 300 ? ev.content.slice(0, 300) + '...' : ev.content)
                : (JSON.stringify(ev.content, null, 2).length > 300 ? JSON.stringify(ev.content, null, 2).slice(0, 300) + '...' : JSON.stringify(ev.content, null, 2))
              }
            </pre>
          )}
        </div>
      )
    }
    if (ev.type === 'complete') {
      return (
        <div key={idx} className="run-event run-event-complete">
          &gt; Athena run complete.
        </div>
      )
    }
    if (ev.type === 'error') {
      return (
        <div key={idx} className="run-event run-event-error">
          🛑 Error: {ev.message || ev.content || 'Run failed'}
        </div>
      )
    }
    return null
  }
  
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
  const [activeTab, setActiveTab] = useState<'squad' | 'projects' | 'blueprint' | 'settings'>('projects')
  type ForgeFlowStage = 'overview' | 'project' | 'feature' | 'stories' | 'team' | 'squad' | 'sprint' | 'legacy-squad'
  const [activeFlowStage, setActiveFlowStage] = useState<ForgeFlowStage>('overview')
  const [productSubTab, setProductSubTab] = useState<'athena' | 'blueprints'>('blueprints')
  const [isLeftPaneOpen, setIsLeftPaneOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState('squad-stats')
  const [isDeveloperModalOpen, setIsDeveloperModalOpen] = useState(false)
  const [developerModalMode, setDeveloperModalMode] = useState<'add' | 'edit'>('add')
  const [developerDraft, setDeveloperDraft] = useState<DeveloperDraft>(createBlankDeveloperDraft())
  const [isAddTicketModalOpen, setIsAddTicketModalOpen] = useState(false)
  const [selectedTicketToEdit, setSelectedTicketToEdit] = useState<JiraTicket | null>(null)

  // Local state for adding vacation to developer in inspector
  const [devVacationType, setDevVacationType] = useState<'vacation' | 'sick' | 'pto'>('vacation')
  const [devVacationTitle, setDevVacationTitle] = useState('Vacation')
  const [devVacationStart, setDevVacationStart] = useState(() => new Date().toISOString().slice(0, 10))
  const [devVacationEnd, setDevVacationEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [devVacationNotes, setDevVacationNotes] = useState('')

  function handleSelectTab(tab: 'squad' | 'projects' | 'blueprint', forceNavigate = false) {
    setSelectedTicketId(null)
    setSelectedDeveloperId(null)
    setSelectedPrdId(null)
    if (activeTab === tab && !forceNavigate) {
      setIsLeftPaneOpen(!isLeftPaneOpen)
    } else {
      setActiveTab(tab)
      setIsLeftPaneOpen(false)
      if (tab !== 'projects') {
        setAthenaContextOverride(null)
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
  const [selectedSprintId, setSelectedSprintId] = useState<string>('')
  
  // Persistent Right Context Rail State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // PRD States
  const [prds, setPrds] = useState<PRDDocument[]>([])
  const [selectedPrdId, setSelectedPrdId] = useState<string | null>(null)
  const [selectedPmProject, setSelectedPmProject] = useState<ProjectEntity | null>(null)
  const [isProjectDrawerOpen, setIsProjectDrawerOpen] = useState(false)
  const [isCreatePrdModalOpen, setIsCreatePrdModalOpen] = useState(false)
  const [projectActionSignal, setProjectActionSignal] = useState<{ type: 'edit' | 'delete' | 'athena' | 'create-feature'; projectId: string; nonce: number } | null>(null)
  const [athenaContextOverride, setAthenaContextOverride] = useState<AthenaContextOverride>(null)
  // Debounce timer ref for server sync on PRD changes
  const prdSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Feature Requests State
  const [features, setFeatures] = useState<FeatureRequest[]>(() => getFeatureRequests())

  // Project Entities State
  const [projectEntities, setProjectEntities] = useState<ProjectEntity[]>(() => getProjectEntities())

  const currentSprint = useMemo(() => {
    const squadPlans = sprintPlans.filter((plan) => plan.squad_id === selectedSquadId)
    if (!config?.current_sprint_id) return squadPlans.find((plan) => plan.status === 'current') || null
    return squadPlans.find((plan) => plan.id === config.current_sprint_id) || squadPlans.find((plan) => plan.status === 'current') || null
  }, [config?.current_sprint_id, selectedSquadId, sprintPlans])

  // Athena Chat Console States
  const [athenaThreads, setAthenaThreads] = useState<AthenaThread[]>(() => loadAthenaThreads())
  const [activeAthenaThreadId, setActiveAthenaThreadId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<AthenaThreadMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeRunEvents, setActiveRunEvents] = useState<any[]>([])
  const [isThreadBrowserOpen, setIsThreadBrowserOpen] = useState(false)

  // New ticket modal/form states
  const [newTicketTitle, setNewTicketTitle] = useState('')
  const [newTicketKey, setNewTicketKey] = useState('')
  const [newTicketSp, setNewTicketSp] = useState('5')
  const [newTicketPriority, setNewTicketPriority] = useState('medium')

  function getFeaturePrdIds(feature: FeatureRequest) {
    const ids = Array.isArray(feature.prd_ids) ? feature.prd_ids.filter(Boolean) : []
    if (ids.length > 0) return ids
    return feature.prd_id ? [feature.prd_id] : []
  }

  // Find active squad
  const activeSquad = config?.squads.find(s => s.id === selectedSquadId) || config?.squads[0]
  const latestSquadSnapshot = squadStatsHistory[squadStatsHistory.length - 1] || null

  // Filter tickets to only show those belonging to the active squad's PRDs or no PRD at all
  const squadScopedTickets = useMemo(() => {
    if (!selectedSquadId) return tickets
    return tickets.filter(t => {
      if (t.prd_id) {
        const prd = prds.find(p => p.id === t.prd_id)
        if (!prd || prd.squadId !== selectedSquadId) {
          return false
        }
      }
      return true
    })
  }, [tickets, prds, selectedSquadId])

  // Calculate Developer allocations & buffer math
  const devLoadStats = activeSquad?.developers.map(dev => {
    const assignedTickets = squadScopedTickets.filter(t => {
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
    const assigned = squadScopedTickets.filter(t => {
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
  const filteredTickets = squadScopedTickets.filter(t => {
    const matchesSearch = t.ticket_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  // Filter PRD registry by active squad
  const displayedPrds = useMemo(() => {
    if (!selectedSquadId) return prds
    return prds.filter(p => p.squadId === selectedSquadId)
  }, [prds, selectedSquadId])
  const squadScopedUnassignedTickets = filteredTickets.filter((ticket) => {
    if (ticket.assignee) return false
    if (!config?.current_project_id) return true
    return ticket.project_id === config.current_project_id || !ticket.project_id
  })
  const groupedBlueprintTickets = useMemo(() => {
    const projectBuckets = new Map<string, {
      projectId: string
      projectName: string
      prdBuckets: Map<string, { prdId: string; prdName: string; tickets: JiraTicket[] }>
    }>()

    squadScopedUnassignedTickets.forEach((ticket) => {
      const project = ticket.project_id
        ? projectEntities.find((item) => item.id === ticket.project_id) || null
        : null
      const projectId = project?.id || 'unassigned-project'
      const projectName = project?.name || 'No Project'
      const prd = ticket.prd_id
        ? prds.find((item) => item.id === ticket.prd_id) || null
        : null
      const prdId = prd?.id || 'unassigned-prd'
      const prdName = prd?.title || 'No PRD'

      if (!projectBuckets.has(projectId)) {
        projectBuckets.set(projectId, {
          projectId,
          projectName,
          prdBuckets: new Map()
        })
      }

      const projectBucket = projectBuckets.get(projectId)!
      if (!projectBucket.prdBuckets.has(prdId)) {
        projectBucket.prdBuckets.set(prdId, {
          prdId,
          prdName,
          tickets: []
        })
      }

      projectBucket.prdBuckets.get(prdId)!.tickets.push(ticket)
    })

    return Array.from(projectBuckets.values())
      .sort((a, b) => a.projectName.localeCompare(b.projectName))
      .map((projectBucket) => ({
        ...projectBucket,
        prdBuckets: Array.from(projectBucket.prdBuckets.values())
          .sort((a, b) => a.prdName.localeCompare(b.prdName))
      }))
  }, [prds, projectEntities, squadScopedUnassignedTickets])

  const selectedTicket = tickets.find(t => t.ticket_id === selectedTicketId)
  const selectedDeveloper = activeSquad?.developers.find(d => d.id === selectedDeveloperId)
  const selectedDevStats = devLoadStats.find(s => s.dev.id === selectedDeveloperId)
  const selectedPrd = prds.find(p => p.id === selectedPrdId)
  const selectedDeveloperSpecialties = selectedDeveloper ? getDeveloperSpecialties(selectedDeveloper) : []
  const selectedProject = activeTab === 'projects' ? selectedPmProject || projectEntities[0] : undefined
  const baseAthenaContextProfile = useMemo(() => buildAthenaContextProfile({
    activeTab,
    activeSquad,
    selectedDeveloper: selectedDeveloper || undefined,
    selectedTicket: selectedTicket || undefined,
    selectedPrd: selectedPrd || undefined,
    selectedProject,
    config
  }), [activeTab, activeSquad, selectedDeveloper, selectedTicket, selectedPrd, selectedProject, config])
  const athenaContextProfile = athenaContextOverride || baseAthenaContextProfile

  const currentAthenaThread = useMemo(() => {
    return athenaThreads.find((thread) => thread.entity?.type === athenaContextProfile.kind && thread.entity?.id === (athenaContextProfile.key.includes(':') ? athenaContextProfile.key.slice(athenaContextProfile.key.indexOf(':') + 1) : athenaContextProfile.key))
      || athenaThreads.find((thread) => thread.contextKey === athenaContextProfile.key) || null
  }, [athenaThreads, athenaContextProfile.key, athenaContextProfile.kind])

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
      setSelectedDeveloperId(null)
      setSelectedTicketId(null)
      setSelectedPrdId(null)
      return
    }
    const nextProfile = await loadProfile(serverUrl)
    setProfile(nextProfile)
    await loadDomainData()
    setSelectedDeveloperId(null)
    setSelectedTicketId(null)
    setSelectedPrdId(null)
  }

  async function loadDomainData(targetServerUrl = serverUrl) {
    const cfg = await getForgeConfig()
    setConfig(cfg)
    if (cfg.active_squad_id) {
      setSelectedSquadId(cfg.active_squad_id)
    }

    const activeWorkspaceId = '17807589009121862532574'
    const fetchedTickets = await fetchJiraTickets(targetServerUrl, activeWorkspaceId)
    setTickets(fetchedTickets)
    const fetchedPrds = await loadPRDsFromServer(targetServerUrl)
    setPrds(fetchedPrds)
    setSprintPlans(getSprintPlans())
    setAvailabilityEvents(getAvailabilityEvents())
    setFeatures(getFeatureRequests())
    setProjectEntities(getProjectEntities())
    const snapshot = recordSprintSnapshot(cfg.squads.find((squad) => squad.id === cfg.active_squad_id), fetchedTickets)
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  async function handleLoginWithKey(key: string, selectedServerUrl?: string) {
    const targetServerUrl = selectedServerUrl?.trim() || serverUrl
    const nextProfile = await login(targetServerUrl, key)
    setServerUrl(targetServerUrl)
    localStorage.setItem('savant_server_url', targetServerUrl)
    setProfile(nextProfile)
    await loadDomainData(targetServerUrl)
    setSelectedDeveloperId(null)
    setSelectedTicketId(null)
    setSelectedPrdId(null)
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

  async function handleDeleteTicket(ticketId: string) {
    const ticket = tickets.find((item) => item.ticket_id === ticketId)
    if (!ticket || ticket.assignee) return
    if (!confirm(`Delete ${ticket.ticket_key}? This cannot be undone.`)) return

    setTickets((prev) => prev.filter((item) => item.ticket_id !== ticketId))
    if (selectedTicketId === ticketId) {
      setSelectedTicketId(null)
      setRightPanelTab('ticket-inspector')
    }
    await deleteTicketLocal(serverUrl, ticketId)
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

  function handleDeleteAvailabilityEvent(id: string) {
    deleteAvailabilityEvent(id)
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
      entity: {
        type: athenaContextProfile.kind,
        id: athenaContextProfile.key.includes(':') ? athenaContextProfile.key.slice(athenaContextProfile.key.indexOf(':') + 1) : athenaContextProfile.key,
        name: threadTitle
      },
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
    const provider = config?.athena_provider || 'codex'
    const model = config?.athena_model || 'gpt-5-codex'

    setActiveRunId(tempRunId)
    setActiveRunEvents([{ type: 'thinking', status: 'running', provider, model, reason: 'initiating request' }])

    try {
      const mcpTools = await fetchAthenaMcpTools(serverUrl, getStoredApiKey() || 'test-key')
      const provider = config?.athena_provider || 'codex'
      const model = config?.athena_model || 'gpt-5-codex'

      let contextSections = [...athenaContextProfile.promptSections]
      const savantContextHits = await fetchAthenaCodeContext(
        serverUrl,
        getStoredApiKey() || 'test-key',
        promptText,
        'savant-forge'
      )
      contextSections.push(['SAVANT CONTEXT', formatAthenaContextHits(savantContextHits)])
      const targetPrdId = threadId.startsWith('athena-thread-prd:') 
        ? threadId.replace('athena-thread-prd:', '') 
        : athenaContextProfile.key.startsWith('prd:') 
        ? athenaContextProfile.key.replace('prd:', '') 
        : null

      if (targetPrdId) {
        const threadPrd = prds.find(p => p.id === targetPrdId)
        if (threadPrd) {
          contextSections = contextSections.filter(([title]) => title !== 'TARGET ENTITY' && title !== 'PRD CONTENT')
          contextSections.push(['TARGET ENTITY', `prd_id=${threadPrd.id}\ntitle=${threadPrd.title}`])
          contextSections.push(['PRD CONTENT', threadPrd.content])
        }
      } else {
        const isHelpPrd = promptText.toLowerCase().includes('help me understand this prd') ||
                          promptText.toLowerCase().includes('understand this prd') ||
                          promptText.toLowerCase().includes('help me understand the prd')
        if (isHelpPrd) {
          const activePrd = selectedPrd || (prds.length > 0 ? prds[0] : null)
          if (activePrd) {
            contextSections = contextSections.filter(([title]) => title !== 'TARGET ENTITY' && title !== 'PRD CONTENT')
            contextSections.push(['TARGET ENTITY', `prd_id=${activePrd.id}\ntitle=${activePrd.title}`])
            contextSections.push(['PRD CONTENT', activePrd.content])
          }
        }
      }

      let activePersonaText = athenaPersona.systemPromptText
      let mcpPersonaId = ''
      let mcpTags: string[] = []

      if (athenaContextProfile.kind === 'prd') {
        mcpPersonaId = 'persona.product'
        mcpTags = ['product']
      } else if (athenaContextProfile.kind === 'ticket' || athenaContextProfile.kind === 'squad' || athenaContextProfile.kind === 'developer' || athenaContextProfile.kind === 'blueprint') {
        mcpPersonaId = 'persona.engineer'
        mcpTags = ['engineering']
      }

      if (mcpPersonaId) {
        const resolved = await resolveAthenaPersona(serverUrl, mcpPersonaId, mcpTags)
        if (resolved) {
          activePersonaText = resolved
        }
      }

      const systemPrompt = buildAthenaPromptSections([
        ['ACTIVE PERSONA', activePersonaText],
        ['AVAILABLE MCP TOOLS', mcpTools.map((t: any) => `- ${t.name}: ${t.description}`).join('\n')],
        ['ATHENA RUNTIME', `provider=${provider}\nmodel=${model}`],
        ...contextSections
      ])

      const currentUserName = getAthenaUserName(profile)
      const historyItems: string[] = []
      chatMessages.forEach((msg) => {
        if (msg.sender === 'user') {
          historyItems.push(`OPERATOR: ${msg.text}`)
        } else {
          historyItems.push(`ATHENA: ${msg.text}`)
        }
      })
      const chatHistoryText = historyItems.join('\n')

      const composedPrompt = [
        systemPrompt,
        '',
        ...(chatHistoryText ? ['[CHAT HISTORY]', chatHistoryText, ''] : []),
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

      const runData = await window.system?.runAgentViaGateway?.({
        prompt: composedPrompt,
        chain: [{ provider, model }],
        cwd: '/Users/home/code/project-x/savant-forge',
        contextKey: athenaContextProfile.key,
        contextKind: athenaContextProfile.kind,
        threadId,
        tempRunId,
        workspace_id: FORGE_WORKSPACE_ID
      })

      const runId = String((runData as any)?.id || tempRunId)
      const finalText = cleanAthenaOutput(String((runData as any)?.message || 'Run completed.'))

      if (runId !== tempRunId) {
        const currentRuns = loadAthenaRuns().filter((r) => r.id !== tempRunId)
        saveAthenaRuns(currentRuns)
      }

      upsertAthenaRun({
        id: runId,
        provider,
        model,
        status: 'complete',
        startedAt,
        endedAt: new Date().toISOString(),
        prompt: promptText,
        message: finalText,
        events: [{ type: 'complete', status: 'complete', content: finalText }],
        source: 'gateway',
        app: 'forge',
        workspace_id: FORGE_WORKSPACE_ID,
        contextKey: athenaContextProfile.key,
        contextKind: athenaContextProfile.kind
      })
      setAthenaThreadActiveRun(threadId, '')
      appendAthenaThreadMessage(threadId, {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: finalText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })
      setChatMessages((prev) => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: finalText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
      
      setIsAiLoading(false)
      setActiveRunId(null)
      setActiveRunEvents([])

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
      setActiveRunId(null)
      setActiveRunEvents([])
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
    const threadId = activeAthenaThreadId || (athenaContextProfile ? `athena-thread-${athenaContextProfile.key}` : null)
    if (threadId) {
      deleteAthenaThreadMessage(threadId, messageId)
    }
    setChatMessages((prev) => prev.filter((message) => message.id !== messageId))
  }

  function handleRestoreAthenaThread(thread: AthenaThread) {
    setActiveAthenaThreadId(thread.id)
    setChatMessages(thread.messages)
    setActiveRunId(null)
    setActiveRunEvents([])
    setIsThreadBrowserOpen(false)

    // Parse kind and key to restore selection
    const { contextKind, contextKey } = thread
    
    if (contextKind === 'prd') {
      const prdId = contextKey.replace('prd:', '')
      const prd = prds.find(p => p.id === prdId)
      if (prd) {
        setSelectedPrdId(prd.id)
        setActiveTab('projects')
        setAthenaContextOverride(null)
      } else {
        setAthenaContextOverride({
          kind: 'prd',
          key: contextKey,
          title: thread.title,
          summary: `Restored deleted/archived PRD context for "${thread.title}".`,
          promptSections: [['RESTORED CONTEXT', `prd_id=${prdId}\ntitle=${thread.title}`]]
        })
      }
    } else if (contextKind === 'developer') {
      const devId = contextKey.replace('developer:', '')
      const dev = activeSquad?.developers.find(d => d.id === devId)
      if (dev) {
        setSelectedDeveloperId(dev.id)
        setActiveTab('squad')
        setAthenaContextOverride(null)
      } else {
        setAthenaContextOverride({
          kind: 'developer',
          key: contextKey,
          title: thread.title,
          summary: `Restored deleted/archived developer context for "${thread.title}".`,
          promptSections: [['RESTORED CONTEXT', `developer_id=${devId}\nname=${thread.title}`]]
        })
      }
    } else if (contextKind === 'ticket') {
      const ticketId = contextKey.replace('ticket:', '')
      const ticket = tickets.find(t => t.ticket_id === ticketId)
      if (ticket) {
        setSelectedTicketId(ticket.ticket_id)
        setActiveTab('blueprint')
        setAthenaContextOverride(null)
      } else {
        setAthenaContextOverride({
          kind: 'ticket',
          key: contextKey,
          title: thread.title,
          summary: `Restored deleted/archived ticket context for "${thread.title}".`,
          promptSections: [['RESTORED CONTEXT', `ticket_id=${ticketId}\nkey=${thread.title}`]]
        })
      }
    } else if (contextKind === 'squad') {
      const squadId = contextKey.replace('squad:', '')
      const squad = config?.squads.find(s => s.id === squadId)
      if (squad) {
        setSelectedSquadId(squad.id)
        setActiveTab('squad')
        setAthenaContextOverride(null)
      } else {
        setAthenaContextOverride({
          kind: 'squad',
          key: contextKey,
          title: thread.title,
          summary: `Restored deleted/archived squad context for "${thread.title}".`,
          promptSections: [['RESTORED CONTEXT', `squad_id=${squadId}\nname=${thread.title}`]]
        })
      }
    } else if (contextKind === 'project') {
      const projId = contextKey.replace('project:', '')
      const proj = projectEntities.find(p => p.id === projId)
      if (proj) {
        setSelectedPmProject(proj)
        setActiveTab('projects')
        setAthenaContextOverride(null)
      } else {
        setAthenaContextOverride({
          kind: 'project',
          key: contextKey,
          title: thread.title,
          summary: `Restored deleted/archived project context for "${thread.title}".`,
          promptSections: [['RESTORED CONTEXT', `project_id=${projId}\nname=${thread.title}`]]
        })
      }
    } else {
      setAthenaContextOverride(null)
    }
  }

  function handleDeleteAthenaThread(threadId: string) {
    deleteAthenaThread(threadId)
    setAthenaThreads(loadAthenaThreads())
    if (activeAthenaThreadId === threadId) {
      setActiveAthenaThreadId(null)
      setChatMessages([])
    }
  }

  // Debounced server sync helper for PRDs - saves immediately to localStorage, syncs to server after delay
  const debouncedSyncPRDs = useCallback((nextPrds: PRDDocument[]) => {
    if (prdSyncTimerRef.current) {
      clearTimeout(prdSyncTimerRef.current)
    }
    prdSyncTimerRef.current = setTimeout(() => {
      syncPRDsToServer(serverUrl, nextPrds).catch(console.error)
      prdSyncTimerRef.current = null
    }, 1500)
  }, [serverUrl])

  // Handle PRD Creation immediately
  function handleCreateNewPrd() {
    const newPrd: PRDDocument = {
      id: `prd-${Math.random().toString(36).slice(2, 10)}`,
      title: 'New PRD',
      content: '# New PRD\n\nEdit your PRD requirements here...',
      status: 'draft',
      squadId: selectedSquadId || undefined,
      lastUpdated: new Date().toISOString()
    }
    // Save to localStorage immediately for persistence
    const updated = saveLocalPRD(newPrd)
    setPrds(updated)
    // Immediately sync to server on creation (not debounced) to ensure PRD is persisted
    syncPRDsToServer(serverUrl, updated).catch(console.error)
    setSelectedPrdId(newPrd.id)
    setRightPanelTab('prd-inspector')
    setRightPanelOpen(true)
  }

  function handleCreatePrdFromModal(draft: { title: string; content: string }) {
    const newPrd: PRDDocument = {
      id: `prd-${Math.random().toString(36).slice(2, 10)}`,
      title: draft.title.trim() || 'New PRD',
      content: draft.content.trim() || '# New PRD\n\nEdit your PRD requirements here...',
      status: 'draft',
      squadId: selectedSquadId || undefined,
      project_id: selectedPmProject?.id,
      lastUpdated: new Date().toISOString(),
      epic_ids: []
    }
    const updated = saveLocalPRD(newPrd)
    setPrds(updated)
    syncPRDsToServer(serverUrl, updated).catch(console.error)
    setSelectedPrdId(newPrd.id)
    setRightPanelTab('prd-inspector')
    setRightPanelOpen(true)
    setIsCreatePrdModalOpen(false)
  }

  // Handle PRD Updates - saves to localStorage immediately, debounces server sync
  function handleUpdatePrd(prdId: string, fields: Partial<PRDDocument>, shouldSync = true) {
    const prd = prds.find(p => p.id === prdId)
    if (!prd) return
    const updatedPrd = {
      ...prd,
      ...fields,
      lastUpdated: new Date().toISOString()
    }
    // Always save to localStorage immediately for persistence
    const nextPrds = saveLocalPRD(updatedPrd)
    setPrds(nextPrds)
    if (shouldSync) {
      // Debounced server sync to avoid network spam on every keystroke
      debouncedSyncPRDs(nextPrds)
    }
  }

  function handleDeletePrd(prdId: string) {
    if (confirm("Are you sure you want to delete this PRD?")) {
      const updated = deleteLocalPRD(prdId)
      setPrds(updated)
      syncPRDsToServer(serverUrl, updated).catch(console.error)
      if (selectedPrdId === prdId) {
        setSelectedPrdId(null)
      }
    }
  }

  async function ensurePrdEpic(prd: PRDDocument): Promise<JiraTicket> {
    const project = prd.project_id ? projectEntities.find((item) => item.id === prd.project_id) : undefined
    const candidateIds = [...(prd.epic_ids || []), project?.epic_ticket_id || ''].filter(Boolean)
    const existing = tickets.find((ticket) =>
      ticket.issue_type === 'epic' && candidateIds.some((candidate) => candidate === ticket.ticket_id || candidate === ticket.ticket_key)
    )
    if (existing) return existing

    const epic = await createTicketLocal(serverUrl, {
      workspace_id: FORGE_WORKSPACE_ID,
      ticket_key: `FORGE-EPIC-${prd.id.replace(/[^a-z0-9]/gi, '').slice(-12)}`,
      title: `EPIC: ${prd.title.replace(/^PRD:\s*/i, '')}`,
      description: prd.epic_summary || generateOneLineEpic(prd.title, prd.content),
      issue_type: 'epic',
      prd_id: prd.id,
      project_id: prd.project_id,
      status: 'todo',
      priority: 'high',
      reporter: profile?.name || 'forge',
      assignee: '',
      story_points: 0
    })
    setTickets((current) => current.some((ticket) => ticket.ticket_id === epic.ticket_id) ? current : [...current, epic])
    return epic
  }

  async function handlePushToConfluence(prdId: string) {
    try {
      const updated = await pushToConfluence(prdId)
      setPrds(prev => {
        const next = prev.map(p => p.id === prdId ? updated : p)
        syncPRDsToServer(serverUrl, next).catch(console.error)
        return next
      })
    } catch (e) {
      console.error(e)
    }
  }

  async function handleCreateTicketFromPRD(draft: { ticket_key: string; title: string; story_points: number; priority: string }) {
    if (!selectedPrdId) return
    const activeWorkspaceId = '17807589009121862532574'
    const spText = `[SP-${draft.story_points}]`
    const finalTitle = draft.title.toLowerCase().includes('sp-') 
      ? draft.title 
      : `${spText} ${draft.title}`

    try {
      const prd = prds.find((item) => item.id === selectedPrdId)
      if (!prd) return
      const epic = await ensurePrdEpic(prd)
      if (!(prd.epic_ids || []).includes(epic.ticket_id)) {
        handleSavePrdFromPM({ ...prd, epic_ids: [...(prd.epic_ids || []), epic.ticket_id], lastUpdated: new Date().toISOString() })
      }
      const created = await createTicketLocal(serverUrl, {
        workspace_id: activeWorkspaceId,
        ticket_key: draft.ticket_key,
        title: finalTitle,
        status: 'todo',
        priority: draft.priority,
        reporter: profile?.name || 'ahmed',
        prd_id: selectedPrdId,
        issue_type: 'story',
        epic_ticket_id: epic.ticket_id
      })

      setTickets(prev => [...prev, created])
      const nextTickets = [...tickets, created]
      const snapshot = recordSprintSnapshot(activeSquad, nextTickets)
      if (snapshot) {
        setSquadStatsHistory(getSquadStatsHistory())
      }
      setSelectedTicketId(created.ticket_id)
    } catch (e) {
      console.error(e)
    }
  }

  async function handleUpdateTicketFromModal(ticketId: string, draft: { ticket_key: string; title: string; story_points: number; priority: string }) {
    const ticket = tickets.find(t => t.ticket_id === ticketId)
    if (!ticket) return
    const spText = `[SP-${draft.story_points}]`
    const finalTitle = draft.title.toLowerCase().includes('sp-') 
      ? draft.title 
      : `${spText} ${draft.title}`

    const updated = {
      ...ticket,
      ticket_key: draft.ticket_key,
      title: finalTitle,
      story_points: draft.story_points,
      priority: draft.priority
    }

    setTickets(prev => prev.map(t => t.ticket_id === ticketId ? updated : t))
    await updateTicketLocal(serverUrl, updated)
    const snapshot = recordSprintSnapshot(activeSquad, tickets.map(t => t.ticket_id === ticketId ? updated : t))
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  async function handleUpdateTicket(ticketId: string, fields: Partial<JiraTicket>) {
    const ticket = tickets.find(t => t.ticket_id === ticketId)
    if (!ticket) return
    const updated = { ...ticket, ...fields }
    setTickets(prev => prev.map(t => t.ticket_id === ticketId ? updated : t))
    await updateTicketLocal(serverUrl, updated)
    const snapshot = recordSprintSnapshot(activeSquad, tickets.map(t => t.ticket_id === ticketId ? updated : t))
    if (snapshot) {
      setSquadStatsHistory(getSquadStatsHistory())
    }
  }

  // ─── PM Flow: Feature and Project Handlers ────────────────────────────────

  function handleSaveProjectEntity(project: ProjectEntity) {
    saveProjectEntity(project)
    setProjectEntities(getProjectEntities())
  }

  function handleSaveFeature(feature: FeatureRequest) {
    saveFeatureRequest(feature)
    setFeatures(getFeatureRequests())
  }

  function handleDeleteFeature(featureId: string) {
    if (confirm('Delete this feature request?')) {
      deleteFeatureRequest(featureId)
      setFeatures(getFeatureRequests())
    }
  }

  function handleSavePrdFromPM(prd: PRDDocument) {
    const nextPrds = saveLocalPRD(prd)
    setPrds(nextPrds)
    debouncedSyncPRDs(nextPrds)
  }

  function handleDeletePrdFromPM(prdId: string) {
    if (confirm('Delete this PRD?')) {
      const updated = deleteLocalPRD(prdId)
      setPrds(updated)
      syncPRDsToServer(serverUrl, updated).catch(console.error)
      if (selectedPrdId === prdId) setSelectedPrdId(null)
    }
  }

  function handleConvertFeatureToPRD(feature: FeatureRequest): PRDDocument {
    const structured = createStructuredPrd(feature.title, [{
      source: 'Forge feature request',
      summary: feature.description || 'No additional feature context was provided.'
    }])
    const newPrd: PRDDocument = {
      id: `prd-${Math.random().toString(36).slice(2, 10)}`,
      title: structured.title,
      content: structured.content,
      status: 'draft',
      squadId: selectedSquadId,
      project_id: feature.project_id,
      feature_id: feature.id,
      lastUpdated: new Date().toISOString(),
      epic_ids: [],
      epic_summary: generateOneLineEpic(structured.title, structured.content)
    }
    const nextPrds = saveLocalPRD(newPrd)
    setPrds(nextPrds)
    syncPRDsToServer(serverUrl, nextPrds).catch(console.error)

    // Mark feature as having another linked PRD while preserving earlier PRDs.
    const nextFeaturePrdIds = [...getFeaturePrdIds(feature), newPrd.id]
    const updatedFeature: FeatureRequest = {
      ...feature,
      prd_ids: nextFeaturePrdIds,
      prd_id: nextFeaturePrdIds[0],
      updated_at: new Date().toISOString()
    }
    saveFeatureRequest(updatedFeature)
    setFeatures(getFeatureRequests())

    return newPrd
  }

  async function handleGeneratePlanFromPrd(prd: PRDDocument, planTickets: ReturnType<typeof decomposeEpicIntoTickets>, sprintId?: string) {
    try {
      const epic = prd.epic_summary || generateOneLineEpic(prd.title, prd.content)
      const epicTicket = await ensurePrdEpic({ ...prd, epic_summary: epic })
      const updatedPrd = {
        ...prd,
        epic_summary: epic,
        epic_ids: Array.from(new Set([...(prd.epic_ids || []), epicTicket.ticket_id])),
        lastUpdated: new Date().toISOString()
      }
      handleSavePrdFromPM(updatedPrd)
      const activeWorkspaceId = FORGE_WORKSPACE_ID
      const finalized = finalizePlanningSummary({
        prdId: prd.id,
        prdTitle: prd.title,
        epic,
        tickets: planTickets,
        sprintId,
        sprintName: sprintId ? sprintPlans.find((sprint) => sprint.id === sprintId)?.name : undefined,
        context: (prd as any).context || []
      })
      const created = await Promise.all(finalized.tickets.map((planTicket) => {
        const selectedSquad = config?.squads?.find((squad) => squad.name === planTicket.suggested_squad) || config?.squads?.[0]
        const selectedOwner = selectedSquad?.developers?.find((developer) => developer.name === planTicket.suggested_owner)
        return createTicketLocal(serverUrl, {
          workspace_id: activeWorkspaceId,
          ticket_key: planTicket.ticket_key,
          title: planTicket.title,
          description: planTicket.description,
          acceptance_criteria: planTicket.acceptance_criteria,
          review_status: 'accepted',
          suggested_owner: planTicket.suggested_owner,
          suggested_squad: planTicket.suggested_squad,
          squad_id: selectedSquad?.id,
          issue_type: 'story',
          epic_ticket_id: epicTicket.ticket_id,
          prd_id: prd.id,
          project_id: prd.project_id,
          sprint_id: sprintId,
          status: 'todo',
          priority: planTicket.priority,
          assignee: selectedOwner?.id || selectedOwner?.name || '',
          reporter: 'forge',
          story_points: 0
        })
      }))
      setTickets((current) => [...current, ...created])
      void syncFinalizedPlanSummary(serverUrl, activeWorkspaceId, finalized).catch((error) => console.error('Forge Knowledge sync queued for retry', error))
    } catch (error) {
      console.error('Failed to generate Forge plan tickets', error)
      throw error
    }
  }

  function handleOpenAthenaFromPM(contextKey: string, contextKind: string, contextData: Record<string, unknown>) {
    // Build the Athena context sections from PM data
    const contextTitle = contextKind === 'prd'
      ? `PRD: ${(contextData.prd as any)?.title || 'PRD'}`
      : contextKind === 'feature'
      ? `Feature: ${(contextData.feature as any)?.title || 'Feature'}`
      : contextKind === 'project'
      ? `Project: ${(contextData.project as any)?.name || 'Project'}`
      : 'Athena'
    const sections: [string, string][] = [
      ['CONTEXT MODE', contextKind === 'prd' ? 'PRD / PM-Architect' : 'Product Planning'],
    ]

    if (contextData.project) {
      const proj = contextData.project as any
      sections.push(['PROJECT CONTEXT', `name=${proj.name}\ndescription=${proj.description}\ngoals=${proj.goals || ''}\nfeatures=${proj.features_summary ? JSON.stringify(proj.features_summary) : ''}`])
    }

    if (contextData.feature) {
      const feat = contextData.feature as any
      sections.push(['FEATURE CONTEXT', `title=${feat.title}\ndescription=${feat.description}\nstatus=${feat.status}`])
    }

    if (contextData.prd) {
      const prdData = contextData.prd as any
      sections.push(['PRD CONTEXT', `title=${prdData.title}\nstatus=${prdData.status}`])
      sections.push(['PRD CONTENT', prdData.content || ''])
    }

    setAthenaContextOverride({
      kind: contextKind as AthenaContextKind,
      key: contextKey,
      title: contextTitle,
      summary: sections.map(([section, body]) => `${section}\n${body}`).join('\n\n'),
      promptSections: sections
    })

    // Open the Athena chat panel with this context
    setRightPanelTab('athena-chat')
    setRightPanelOpen(true)

    // Force switch to the right context kind for Athena
    if (contextKind === 'prd') {
      const matchedPrd = prds.find(p => contextKey === `prd:${p.id}`)
      if (matchedPrd) setSelectedPrdId(matchedPrd.id)
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
    const isPrdThread = athenaContextProfile.kind === 'prd' && !athenaContextProfile.key.endsWith(':global')
    const prdId = isPrdThread ? athenaContextProfile.key.replace('prd:', '') : null
    const prd = prdId ? prds.find(p => p.id === prdId) : null

    const greeting: AthenaThreadMessage = {
      id: 'init',
      sender: prd ? 'user' : 'assistant',
      text: prd ? prd.content : buildAthenaGreeting(userName),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const existing = athenaThreads.find((thread) => thread.contextKey === athenaContextProfile.key)
    if (!existing) {
      const createdThread: AthenaThread = {
        id: `athena-thread-${athenaContextProfile.key}`,
        entity: {
          type: athenaContextProfile.kind,
          id: athenaContextProfile.key.includes(':') ? athenaContextProfile.key.slice(athenaContextProfile.key.indexOf(':') + 1) : athenaContextProfile.key,
          name: getAthenaThreadTitle(athenaContextProfile.kind, athenaContextProfile.title, 'Athena')
        },
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
  }, [profile, athenaContextProfile.key, athenaContextProfile.kind, athenaContextProfile.title, athenaThreads, prds])

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
    if (!window.system?.onAthenaRunEvent) return

    const unsubscribe = window.system.onAthenaRunEvent((data) => {
      const { runId, tempRunId, event } = data
      
      setActiveRunId((currentActiveRunId) => {
        if (!currentActiveRunId) return currentActiveRunId

        // If we get a 'started' event and the tempRunId matches, swap activeRunId to the real runId
        if (event?.type === 'started' && tempRunId && currentActiveRunId === tempRunId) {
          const threadId = activeAthenaThreadId || (athenaContextProfile ? `athena-thread-${athenaContextProfile.key}` : '')
          if (threadId) {
            setAthenaThreadActiveRun(threadId, runId)
          }
          setActiveRunEvents([{ type: 'thinking', status: 'running', reason: 'initiating stream' }])
          return runId
        }

        // If this event belongs to our active run
        if (currentActiveRunId === runId || currentActiveRunId === tempRunId) {
          if (event?.type === 'chunk') {
            // Text chunks are streamed directly, we skip showing them in the logs.
            return currentActiveRunId
          }
          
          setActiveRunEvents((prevEvents) => {
            const isDuplicate = prevEvents.some(
              (pe) => pe.type === event.type && pe.status === event.status && pe.reason === event.reason && pe.name === event.name
            )
            if (isDuplicate) return prevEvents
            return [...prevEvents, event]
          })
        }

        return currentActiveRunId
      })
    })

    return () => {
      unsubscribe()
    }
  }, [activeAthenaThreadId, athenaContextProfile])

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

  // Bug Fix: When right panel closes while a PRD is selected, flush any pending debounced server sync immediately
  useEffect(() => {
    if (!rightPanelOpen && selectedPrdId) {
      if (prdSyncTimerRef.current) {
        clearTimeout(prdSyncTimerRef.current)
        prdSyncTimerRef.current = null
      }
      // Flush sync immediately when closing panel
      const currentPrds = getLocalPRDs()
      syncPRDsToServer(serverUrl, currentPrds).catch(console.error)
    }
  }, [rightPanelOpen, selectedPrdId, serverUrl])

  // Bug Fix: When a PRD is opened, immediately save it to localStorage and trigger a server sync
  // This ensures the PRD is persisted even if user closes without making any changes
  useEffect(() => {
    if (selectedPrdId) {
      const prd = getLocalPRDs().find(p => p.id === selectedPrdId)
      if (prd) {
        // Trigger a server sync immediately when opening a PRD to ensure it's persisted
        syncPRDsToServer(serverUrl, getLocalPRDs()).catch(console.error)
      }
    }
  }, [selectedPrdId, serverUrl])


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

  if (!profile) {
    return <LoginScreen onLogin={handleLoginWithKey} initialServerUrl={serverUrl} />
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
        <aside className="icon-rail" style={{ background: 'linear-gradient(180deg, var(--cp-bg-1), rgba(0,229,255,0.035), var(--cp-bg-1))', borderRight: '1px solid var(--cp-border)', width: '40px' }} data-testid="left-rail">
          <div className="rail-top" style={{ width: '100%', padding: '8px 0', gap: '1px' }}>
            {[
              { label: 'OVERVIEW', flow: 'overview' as const, icon: <Activity size={13} />, tab: 'projects' as const, testid: 'tab-overview', hint: 'Product and delivery overview' },
              { label: 'PROJECT', flow: 'project' as const, icon: <FileText size={13} />, tab: 'projects' as const, testid: 'tab-projects', hint: 'Open first project' },
              { label: 'FEATURE', flow: 'feature' as const, icon: <Tag size={13} />, tab: 'projects' as const, testid: 'tab-feature', hint: 'Shape feature' },
              { label: 'STORIES', flow: 'stories' as const, icon: <Layers size={13} />, tab: 'blueprint' as const, testid: 'tab-blueprint', hint: 'Break into tasks' },
              { label: 'TEAM', flow: 'team' as const, icon: <Users size={13} />, tab: 'squad' as const, testid: 'tab-team', hint: 'See people' },
              { label: 'SQUAD', flow: 'squad' as const, icon: <Shield size={13} />, tab: 'squad' as const, testid: 'tab-squad', hint: 'Choose delivery group' },
              { label: 'SPRINT', flow: 'sprint' as const, icon: <CalendarDays size={13} />, tab: 'blueprint' as const, testid: 'tab-sprint', hint: 'Place scope' }
            ].map((stage, index) => {
              const isActive = activeFlowStage === stage.flow
              return <div key={stage.label} style={{ position: 'relative', width: '40px' }}>
                <button
                  className={`nav-icon ${isActive ? 'active' : ''}`}
                  onClick={() => { setActiveFlowStage(stage.flow); handleSelectTab(stage.tab, true) }}
                  title={`${stage.label.toLowerCase()} · ${stage.hint}`}
                  aria-current={isActive ? 'step' : undefined}
                  data-testid={stage.testid}
                  style={{ width: '40px', height: '40px', minHeight: '40px', padding: 0, display: 'grid', placeItems: 'center', border: 0, borderLeft: isActive ? '2px solid var(--cp-cyan)' : '2px solid transparent', background: isActive ? 'rgba(0,229,255,0.1)' : 'transparent', clipPath: 'none' }}
                >
                  <span style={{ color: isActive ? 'var(--cp-cyan)' : 'var(--muted-foreground)' }}>{stage.icon}</span>
                  <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{stage.label}</span>
                  {stage.label === 'PROJECT' && <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>projects</span>}
                  {stage.label === 'STORIES' && <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>blueprints</span>}
                </button>
              </div>
            })}
          </div>
          
          <div className="rail-bottom" style={{ width: '100%', padding: '8px 0' }}>
            <button className="nav-icon" onClick={() => setIsLeftPaneOpen(!isLeftPaneOpen)} title={isLeftPaneOpen ? "Collapse Left Panel" : "Expand Left Panel"} style={{ marginBottom: '8px' }} data-testid="toggle-left-pane">
              {isLeftPaneOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
            <button className={`nav-icon ${isSettingsOpen ? 'active' : ''}`} onClick={() => setIsSettingsOpen(true)} title="settings" data-testid="btn-settings"><Sliders size={16} /><span className="rail-label-text">settings</span></button>
            <button className={`nav-icon logout-icon ${isLogoutConfirmOpen ? 'active' : ''}`} onClick={() => setIsLogoutConfirmOpen(true)} title="Logout" data-testid="btn-logout"><Power size={16} /></button>
          </div>
        </aside>

        {/* Left Collapsible Panel */}
        {activeTab !== 'projects' && (
        <aside className={`left-sidebar left-collapsible-panel ${isLeftPaneOpen ? 'is-open' : 'is-collapsed'}`}>
          {!isLeftPaneOpen ? (
            <>
              <button
                type="button"
                className="left-collapsible-top-toggle"
                onClick={() => setIsLeftPaneOpen(true)}
                title={`Expand ${LEFT_COLLAPSIBLE_LABELS[activeTab].toLowerCase()} panel`}
                aria-label={`Expand ${LEFT_COLLAPSIBLE_LABELS[activeTab].toLowerCase()} panel`}
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                className="left-collapsible-bar"
                onClick={() => setIsLeftPaneOpen(true)}
                title={`Expand ${LEFT_COLLAPSIBLE_LABELS[activeTab].toLowerCase()} panel`}
                aria-label={`Expand ${LEFT_COLLAPSIBLE_LABELS[activeTab].toLowerCase()} panel`}
              >
                {LEFT_COLLAPSIBLE_LABELS[activeTab]}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="left-collapsible-panel-top">
                <span>{LEFT_COLLAPSIBLE_LABELS[activeTab]}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {(activeTab === 'squad' || activeTab === 'blueprint') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'squad') {
                          const name = prompt('Enter new squad name:')
                          if (name && name.trim()) {
                            handleCreateSquad(name.trim())
                          }
                        } else {
                          setSelectedTicketToEdit(null)
                          setIsAddTicketModalOpen(true)
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
                      <Plus size={11} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsLeftPaneOpen(false)}
                    title={`Collapse ${LEFT_COLLAPSIBLE_LABELS[activeTab].toLowerCase()} panel`}
                    aria-label={`Collapse ${LEFT_COLLAPSIBLE_LABELS[activeTab].toLowerCase()} panel`}
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>
            {/* projects tab content is owned by ProductManagerPanel */}


            {activeTab === 'blueprint' && activeFlowStage === 'sprint' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>SQUADS</div>
                {(config?.squads || []).map((squad) => {
                  const isSelectedSquad = selectedSquadId === squad.id
                  const squadPlans = sprintPlans.filter((plan) => plan.squad_id === squad.id)
                  const activePlans = squadPlans.filter((plan) => plan.status === 'current')
                  const futurePlans = squadPlans.filter((plan) => plan.status === 'planned').sort((a, b) => a.start_date.localeCompare(b.start_date))
                  const previousPlans = squadPlans.filter((plan) => plan.status === 'complete').sort((a, b) => b.end_date.localeCompare(a.end_date))
                  const renderSprint = (plan: SprintPlan) => (
                    <button key={plan.id} type="button" onClick={() => setSelectedSprintId(plan.id)} style={{ width: '100%', textAlign: 'left', border: selectedSprintId === plan.id ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)', background: selectedSprintId === plan.id ? 'rgba(0, 229, 255, 0.08)' : 'var(--cp-bg-2)', color: 'var(--foreground)', padding: '6px 8px', cursor: 'pointer', display: 'grid', gap: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{plan.name}</span>
                      <span style={{ color: 'var(--muted-foreground)', fontSize: '9px', fontFamily: "'Share Tech Mono', monospace" }}>{plan.start_date} → {plan.end_date}</span>
                    </button>
                  )
                  return (
                    <div key={squad.id} style={{ display: 'grid', gap: '5px' }}>
                      <button type="button" onClick={() => { setSelectedSquadId(squad.id); setSelectedSprintId('') }} style={{ width: '100%', textAlign: 'left', border: isSelectedSquad ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)', background: isSelectedSquad ? 'rgba(0, 229, 255, 0.12)' : 'var(--cp-bg-2)', color: isSelectedSquad ? 'var(--cp-cyan)' : 'var(--foreground)', padding: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>
                        {squad.name.toUpperCase()}
                      </button>
                      {isSelectedSquad && (
                        <div style={{ display: 'grid', gap: '8px', paddingLeft: '8px' }}>
                          {[
                            ['ACTIVE SPRINT', activePlans],
                            ['FUTURE SPRINTS', futurePlans],
                            ['PREVIOUS SPRINTS', previousPlans]
                          ].map(([label, plans]) => (
                            <div key={label as string} style={{ display: 'grid', gap: '4px' }}>
                              <div style={{ color: 'var(--section-label)', fontSize: '9px', fontFamily: "'Share Tech Mono', monospace" }}>{label as string}</div>
                              {(plans as SprintPlan[]).length ? (plans as SprintPlan[]).map(renderSprint) : <div style={{ color: 'var(--muted-foreground)', fontSize: '9px', fontStyle: 'italic', padding: '3px 0' }}>None</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'blueprint' && activeFlowStage !== 'sprint' && (
              <>
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
                          borderRadius: '4px',
                          padding: '8px',
                          marginBottom: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          alignItems: 'center',
                          boxShadow: isSelected ? '0 0 0 1px rgba(0, 229, 255, 0.08) inset' : 'none'
                        }}
                      >
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", fontWeight: 'bold' }}>{t.ticket_key}</span>
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
                            {t.priority.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ width: '100%', fontSize: '12px', color: isSelected ? 'var(--foreground)' : 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title.replace(/\[SP-\d+\]\s*/i, '')}
                        </div>
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)', opacity: 0.8 }}>
                            {t.sprint_id ? sprintPlans.find(p => p.id === t.sprint_id)?.name || 'Linked' : 'Backlog'}
                          </span>
                          <span style={{ color: 'var(--cp-green)', fontSize: '11px', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>
                            {t.story_points} SP
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {activeTab === 'squad' && (
              <>
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
                  {groupedBlueprintTickets.length === 0 ? (
                    <div style={{ color: 'var(--muted-foreground)', opacity: 0.4, padding: '20px 10px', fontSize: '11px', fontStyle: 'italic', textAlign: 'center' }}>
                      All blueprints matched!
                    </div>
                  ) : (
                    groupedBlueprintTickets.map((projectBucket) => (
                      <div key={projectBucket.projectId} style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 0', borderBottom: '1px solid var(--cp-border)' }}>
                          {projectBucket.projectName}
                          {projectBucket.projectId === 'unassigned-project' ? ' (no project)' : ''}
                        </div>
                        <div style={{ display: 'grid', gap: '10px', paddingLeft: '8px' }}>
                          {projectBucket.prdBuckets.map((prdBucket) => (
                            <div key={prdBucket.prdId} style={{ display: 'grid', gap: '6px' }}>
                              <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {prdBucket.prdName}
                                {prdBucket.prdId === 'unassigned-prd' ? ' (no prd)' : ''}
                              </div>
                              <div style={{ display: 'grid', gap: '6px' }}>
                                {prdBucket.tickets.map((ticket) => (
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
                                      cursor: 'grab',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)', fontSize: '11px', fontWeight: 'bold' }}>
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
                                      <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)', opacity: 0.8 }}>
                                        {ticket.sprint_id ? sprintPlans.find(p => p.id === ticket.sprint_id)?.name || 'Linked' : 'Backlog'}
                                      </span>
                                      <span style={{ color: 'var(--cp-green)', fontSize: '11px', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>
                                        {ticket.story_points} SP
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}

                </div>
              </>
            )}
            </div>
          )}
        </aside>
        )}

        {/* Center Panel Workspace: The Drag Targets and Capability Grid */}
        <main
          className="chat-area"
          style={{
            flex: 1,
            padding: activeTab === 'projects' ? '0' : '16px',
            background: 'var(--cp-bg-0)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          
          {activeTab === 'projects' && (activeFlowStage === 'overview' || activeFlowStage === 'project') && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflow: 'hidden', padding: '0' }}>
                <ProductManagerPanel
                  projects={projectEntities}
                  features={features}
                  prds={prds}
                  tickets={tickets}
                  squads={config?.squads || []}
                  sprintPlans={sprintPlans}
                  activeSquadId={selectedSquadId}
                  onSaveProject={handleSaveProjectEntity}
                  onSaveFeature={handleSaveFeature}
                  onDeleteFeature={handleDeleteFeature}
                  onSavePRD={handleSavePrdFromPM}
                  onDeletePRD={handleDeletePrdFromPM}
                  onConvertFeatureToPRD={handleConvertFeatureToPRD}
                  onGeneratePlan={handleGeneratePlanFromPrd}
                  onOpenAthena={handleOpenAthenaFromPM}
                  onNewProject={() => {
                    setProjectActionSignal(null)
                    setSelectedPmProject(null)
                    setIsProjectDrawerOpen(false)
                  }}
                  onSelectionChange={(_, project) => setSelectedPmProject(project || null)}
                  onProjectDrawerChange={setIsProjectDrawerOpen}
                  onRequestEditProject={(project) => setProjectActionSignal({ type: 'edit', projectId: project.id, nonce: Date.now() })}
                  onRequestDeleteProject={(project) => {
                    if (!confirm(`Delete ${project.name}?`)) return
                    setProjectActionSignal({ type: 'delete', projectId: project.id, nonce: Date.now() })
                  }}
                  projectActionSignal={projectActionSignal}
                  openInitialProject={activeFlowStage === 'project'}
                  selectedPrdId={selectedPrdId}
                  onSelectPrd={(prdId) => {
                    setSelectedPrdId(prdId)
                    if (prdId) {
                      setRightPanelTab('prd-inspector')
                      setRightPanelOpen(true)
                    }
                  }}
                />
              </div>
            </div>
          )}


          {activeTab === 'squad' && activeFlowStage === 'team' && (
            <PeopleManagementPanel
              squads={config?.squads || []}
              tickets={tickets}
              projects={projectEntities}
              features={features}
              sprintPlans={sprintPlans}
              onAddPerson={openAddDeveloperModal}
              onEditPerson={openEditDeveloperModal}
            />
          )}

          {activeTab === 'squad' && activeFlowStage === 'squad' && (
              <TeamsManagementPanel
                squads={config?.squads || []}
                tickets={tickets}
                projects={projectEntities}
                features={features}
                sprintPlans={sprintPlans}
                selectedSquadId={selectedSquadId}
                onSelectSquad={setSelectedSquadId}
                onCreateSquad={handleCreateSquad}
                onRenameSquad={handleUpdateSquadName}
                onAddPerson={openAddDeveloperModal}
                onEditPerson={openEditDeveloperModal}
              />
          )}

          {activeTab === 'squad' && activeFlowStage === 'legacy-squad' && (
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
                prds={prds}
                onSelectPrd={(prdId) => {
                  setSelectedPrdId(prdId)
                  setSelectedTicketId(null)
                  setSelectedDeveloperId(null)
                  setRightPanelTab('prd-inspector')
                  setRightPanelOpen(true)
                }}
              />
            )}

          {activeTab === 'blueprint' && activeFlowStage === 'sprint' && (
            <SprintWorkbenchPanel
              mode="current"
              activeSquad={activeSquad}
              history={squadStatsHistory}
              latest={latestSquadSnapshot}
              sprintPlans={sprintPlans}
              currentSprint={currentSprint}
              availabilityEvents={availabilityEvents}
              tickets={squadScopedTickets}
              onCreateSprint={handleCreateSprint}
              onSetCurrentSprint={handleSetCurrentSprint}
              onCompleteSprint={handleCompleteSprint}
              onAddAvailabilityEvent={handleAddAvailabilityEvent}
              onUpdateTicket={handleUpdateTicket}
              selectedSprintId={selectedSprintId}
              onSelectSprint={setSelectedSprintId}
            />
          )}

          {activeTab === 'blueprint' && activeFlowStage !== 'sprint' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
              <section className="hero-panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">Blueprints</div>
                    <div className="workspace-header-title-row">
                      <h1 className="page-title" style={{ color: 'var(--section-label)' }}>
                        Task Blue print
                      </h1>
                      <div className="workspace-header-meta">
                        <span className="workspace-header-pill workspace-header-pill-active">synced</span>
                        <span className="workspace-header-pill workspace-header-pill-medium">offline ingest</span>
                      </div>
                    </div>
                    <p className="hero-copy">
                      {filteredTickets.length} tickets · {filteredTickets.filter(t => t.status === 'done' || t.status === 'closed').length} done · {filteredTickets.filter(t => t.status === 'in_progress' || t.status === 'in-progress').length} in progress · {filteredTickets.filter(t => !t.assignee).length} unassigned
                    </p>
                  </div>
                </div>
                <div className="fact-strip">
                  <span className="fact-pill">{filteredTickets.length} total tickets</span>
                  <span className="fact-pill">{filteredTickets.filter(t => !t.assignee).length} unassigned</span>
                  <span className="fact-pill">{filteredTickets.filter(t => t.status === 'in_progress' || t.status === 'in-progress').length} in progress</span>
                  <span className="fact-pill">{filteredTickets.filter(t => t.status === 'done' || t.status === 'closed').length} done</span>
                  <span className="fact-pill">{filteredTickets.reduce((acc, t) => acc + (t.story_points || 0), 0)} SP total</span>
                </div>
              </section>

              <div style={{ border: '1px solid var(--cp-border)', background: 'var(--cp-bg-2)', padding: '10px' }}>
                {filteredTickets.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {filteredTickets.map(t => {
                      const assigneeDev = activeSquad?.developers.find(d => d.id === t.assignee)
                      const isSelected = selectedTicketId === t.ticket_id
                      const statusColor = t.status === 'done'
                        ? 'var(--cp-green)'
                        : t.status === 'in_progress' || t.status === 'in-progress'
                          ? 'var(--cp-yellow)'
                          : 'var(--foreground)'
                      return (
                        <button
                          key={t.ticket_id}
                          type="button"
                          onClick={() => {
                            setSelectedTicketId(t.ticket_id)
                            setSelectedPrdId(null)
                            setRightPanelTab('ticket-inspector')
                            setRightPanelOpen(true)
                          }}
                          style={{
                            textAlign: 'left',
                            border: `1px solid ${isSelected ? 'var(--cp-cyan)' : 'var(--cp-border)'}`,
                            background: isSelected ? 'rgba(0, 229, 255, 0.08)' : 'var(--cp-bg-3)',
                            padding: '12px',
                            cursor: 'pointer',
                            display: 'grid',
                            gap: '10px',
                            minHeight: '160px',
                            boxShadow: isSelected ? '0 0 0 1px rgba(0, 229, 255, 0.25) inset' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ display: 'grid', gap: '4px' }}>
                              <div style={{ color: 'var(--section-label)', fontWeight: 700, fontFamily: "'Share Tech Mono', monospace", fontSize: '11px' }}>
                                {t.ticket_key}
                              </div>
                              <div style={{ color: 'var(--foreground)', fontSize: '13px', fontWeight: 600, lineHeight: 1.35 }}>
                                {t.title}
                              </div>
                            </div>
                            <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(255,0,170,0.1)', color: 'var(--cp-magenta)', whiteSpace: 'nowrap' }}>
                              {t.priority.toUpperCase()}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            <span className="fact-pill">{t.story_points} SP</span>
                            <span className="fact-pill">{assigneeDev ? assigneeDev.name : 'Unassigned'}</span>
                            <span className="fact-pill">{t.sprint_id ? sprintPlans.find(p => p.id === t.sprint_id)?.name || 'Linked' : 'Backlog'}</span>
                            <span className="fact-pill" style={{ color: statusColor }}>
                              {t.status.toUpperCase()}
                            </span>
                          </div>

                          <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: 1.45 }}>
                            Click to inspect and open the ticket details panel.
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '16px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px' }}>
                    No tickets match the current filters.
                  </div>
                )}
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
              <span>{rightPanelTab.replace('-', ' ')}</span>
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
              {rightPanelTab === 'project-features' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
                    PROJECT FEATURES
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedPmProject) return
                      setProjectActionSignal({ type: 'create-feature', projectId: selectedPmProject.id, nonce: Date.now() })
                    }}
                    disabled={!selectedPmProject}
                    style={{
                      width: '28px',
                      height: '28px',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(0, 229, 255, 0.08)',
                      border: '1px solid rgba(0, 229, 255, 0.35)',
                      color: 'var(--cp-cyan)',
                      padding: 0,
                      cursor: selectedPmProject ? 'pointer' : 'not-allowed'
                    }}
                    title="Add feature"
                    aria-label="Add feature"
                  >
                    <Plus size={14} />
                  </button>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {selectedPmProject ? features.filter((feature) => feature.project_id === selectedPmProject.id).map((feature) => (
                      <button
                        key={feature.id}
                        type="button"
                        onClick={() => {
                          setActiveTab('projects')
                          setIsLeftPaneOpen(false)
                          setSelectedPmProject(selectedPmProject)
                        }}
                        style={{
                          background: 'var(--cp-bg-2)',
                          border: '1px solid var(--cp-border)',
                          color: 'var(--foreground)',
                          padding: '10px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'grid',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>{feature.title}</span>
                          <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: feature.status === 'final' ? '#00ff88' : '#ffe600' }}>
                            {feature.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                          {feature.description.slice(0, 120) || 'No description yet.'}
                        </div>
                      </button>
                    )) : (
                      <div style={{ color: 'var(--muted-foreground)', fontSize: '12px' }}>Select a project.</div>
                    )}
                  </div>
                </div>
              )}
              {rightPanelTab === 'project-prds' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
                      PROJECT PRDS
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreatePrdModalOpen(true)}
                      style={{
                        width: '24px',
                        height: '24px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 229, 255, 0.1)',
                        border: '1px solid var(--cp-cyan)',
                        color: 'var(--cp-cyan)',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      title="Add PRD"
                      aria-label="Add PRD"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {selectedPmProject ? prds.filter((prd) => prd.project_id === selectedPmProject.id).map((prd) => (
                      <button
                        key={prd.id}
                        type="button"
                        onClick={() => {
                          setSelectedPrdId(prd.id)
                          setRightPanelTab('prd-inspector')
                        }}
                        style={{
                          background: 'var(--cp-bg-2)',
                          border: '1px solid var(--cp-border)',
                          color: 'var(--foreground)',
                          padding: '10px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'grid',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>{prd.title}</span>
                          <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: '#00e5ff' }}>
                            {prd.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                          {prd.content.slice(0, 120) || 'No content yet.'}
                        </div>
                      </button>
                    )) : (
                      <div style={{ color: 'var(--muted-foreground)', fontSize: '12px' }}>Select a project.</div>
                    )}
                  </div>
                </div>
              )}
              {rightPanelTab === 'athena-chat' && (
                <div className="athena-chat-panel">
                  <div className="athena-chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bot size={12} className="athena-chat-bot-icon" />
                      <span>ATHENA PM COPILOT CONVERSATION</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {!isThreadBrowserOpen && (
                        <button
                          type="button"
                          onClick={() => {
                            const threadId = activeAthenaThreadId || (athenaContextProfile ? `athena-thread-${athenaContextProfile.key}` : '')
                            if (threadId && confirm('Delete this conversation? This will clear the chat history.')) {
                              handleDeleteAthenaThread(threadId)
                            }
                          }}
                          title="Delete current conversation"
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 34, 68, 0.4)',
                            color: 'var(--cp-magenta)',
                            padding: '2px 6px',
                            fontSize: '9px',
                            fontFamily: "'Share Tech Mono', monospace",
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Trash2 size={10} />
                          DELETE
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsThreadBrowserOpen(!isThreadBrowserOpen)}
                        title="View chat history threads"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--cp-border)',
                          color: 'var(--cp-cyan)',
                          padding: '2px 6px',
                          fontSize: '9px',
                          fontFamily: "'Share Tech Mono', monospace",
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <History size={10} />
                        {isThreadBrowserOpen ? 'CHAT' : 'HISTORY'}
                      </button>
                    </div>
                  </div>

                  {isThreadBrowserOpen ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', padding: '10px', background: 'var(--cp-bg-2)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '4px', borderBottom: '1px solid var(--cp-border)', paddingBottom: '4px' }}>
                        PAST CONVERSATIONS ({athenaThreads.length})
                      </div>
                      {athenaThreads.length === 0 ? (
                        <div style={{ color: 'var(--muted-foreground)', fontSize: '11px', fontStyle: 'italic', fontFamily: "'Share Tech Mono', monospace", padding: '8px 0', textAlign: 'center' }}>
                          No past conversations found.
                        </div>
                      ) : (
                        athenaThreads
                          .slice()
                          .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime())
                          .map((thread) => (
                            <div
                              key={thread.id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                background: 'var(--cp-bg-3)',
                                border: '1px solid var(--cp-border)',
                                padding: '8px 10px',
                                borderRadius: '2px',
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleRestoreAthenaThread(thread)}
                              className="thread-history-item"
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'left' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--foreground)' }}>
                                    {thread.title}
                                  </span>
                                  <span style={{
                                    fontSize: '8px',
                                    fontFamily: "'Share Tech Mono', monospace",
                                    color: 'var(--cp-cyan)',
                                    background: 'rgba(0, 229, 255, 0.08)',
                                    border: '1px solid rgba(0, 229, 255, 0.15)',
                                    padding: '1px 4px',
                                    marginLeft: '6px',
                                    textTransform: 'uppercase'
                                  }}>
                                    {thread.contextKind}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm(`Delete conversation "${thread.title}"?`)) {
                                      handleDeleteAthenaThread(thread.id)
                                    }
                                  }}
                                  title="Delete thread"
                                  aria-label="Delete thread"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--cp-magenta)',
                                    cursor: 'pointer',
                                    padding: '0 4px',
                                    fontSize: '11px'
                                  }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                                <span>{thread.messages.length} messages</span>
                                <span>{new Date(thread.lastUpdatedAt).toLocaleString()}</span>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="athena-chat-context">
                        <div className="athena-chat-context-label">ACTIVE CONTEXT</div>
                        <div className="athena-chat-context-title">{athenaContextProfile.title}</div>
                        <div className="athena-chat-context-summary">{athenaContextProfile.summary}</div>
                      </div>
                      <div className="athena-chat-meta-row">
                        <span className="athena-meta-badge">PERSONA: {athenaPersona.name}</span>
                        <span className="athena-meta-badge">PROVIDER: {config?.athena_provider || 'codex'}</span>
                        <span className="athena-meta-badge">MODEL: {config?.athena_model || 'gpt-5-codex'}</span>
                      </div>
                      {/* Chat messages viewport */}
                      <div className="athena-chat-viewport">
                        {chatMessages.map(msg => (
                          <div key={msg.id} className={`athena-msg-row ${msg.sender === 'user' ? 'user' : 'assistant'}`}>
                            <div className="athena-msg-avatar">
                              {msg.sender === 'user' ? <UserRound size={12} /> : <Bot size={12} />}
                            </div>
                            <div className="athena-msg-bubble-container">
                              <div className="athena-msg-meta">
                                {msg.sender === 'assistant' ? 'ATHENA' : 'OPERATOR'} · {msg.timestamp}
                              </div>
                              <div className={`athena-msg-bubble ${msg.sender === 'user' ? 'user' : 'assistant'}`}>
                                <div className="athena-msg-content-wrapper">
                                  <div className="athena-msg-text">
                                    {msg.sender === 'user' ? (
                                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                                    ) : (
                                      <div className="athena-markdown-content text-[11px] leading-relaxed">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                      </div>
                                    )}
                                  </div>
                                  <div className="athena-msg-actions">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyAthenaMessage(msg.text)}
                                      title="Copy message"
                                      aria-label="Copy message"
                                      className="athena-msg-action-btn copy"
                                    >
                                      <Copy size={9} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAthenaMessage(msg.id)}
                                      title="Delete message"
                                      aria-label="Delete message"
                                      className="athena-msg-action-btn delete"
                                    >
                                      <Trash2 size={9} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {isAiLoading && (
                          <div className="run-events-container">
                            <div className="run-events-header">
                              <span>ATHENA_ACTIVE_PROCESS</span>
                              <span className="running-dots">...</span>
                            </div>
                            {activeRunEvents.map((ev, idx) => renderAthenaRunEvent(ev, idx))}
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat input box */}
                      <form onSubmit={handleSendAthenaMessage} className="athena-chat-input-form">
                        <input 
                          type="text"
                          placeholder="ask athena..."
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          disabled={isAiLoading}
                          className="athena-chat-input-field"
                        />
                        <button 
                          type="submit"
                          disabled={isAiLoading}
                          className="athena-chat-submit-btn"
                        >
                          <Send size={10} />
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
              {rightPanelTab === 'prd-inspector' && (
                selectedPrd ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
                        PRD DOCUMENT INSPECTOR
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setIsCreatePrdModalOpen(true)}
                          style={{
                            background: 'rgba(0, 229, 255, 0.1)',
                            border: '1px solid var(--cp-cyan)',
                            color: 'var(--cp-cyan)',
                            fontSize: '9px',
                            fontFamily: "'Share Tech Mono', monospace",
                            padding: '1px 6px',
                            cursor: 'pointer'
                          }}
                        >
                          + ADD PRD
                        </button>
                        <span style={{
                          fontSize: '9px',
                          color: 'var(--cp-green)',
                          fontFamily: "'Share Tech Mono', monospace",
                          fontWeight: 'bold'
                        }}>
                          // AUTO-SAVE
                        </span>
                      </div>
                    </div>

                    <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>TITLE</span>
                        <input
                          type="text"
                          value={selectedPrd.title}
                          onChange={(e) => handleUpdatePrd(selectedPrd.id, { title: e.target.value })}
                          onBlur={() => handleUpdatePrd(selectedPrd.id, {})}
                          style={{
                            background: 'var(--cp-bg-3)',
                            border: '1px solid var(--cp-border)',
                            color: 'var(--foreground)',
                            fontSize: '11px',
                            padding: '4px 6px',
                            outline: 'none'
                          }}
                        />
                      </label>

                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>STATUS</span>
                        <select
                          value={selectedPrd.status}
                          onChange={(e) => handleUpdatePrd(selectedPrd.id, { status: e.target.value as any }, true)}
                          style={{
                            background: 'var(--cp-bg-3)',
                            border: '1px solid var(--cp-border)',
                            color: 'var(--foreground)',
                            fontSize: '11px',
                            padding: '4px',
                            outline: 'none'
                          }}
                        >
                          <option value="draft">DRAFT</option>
                          <option value="ready">READY</option>
                          <option value="synced">SYNCED</option>
                        </select>
                      </label>

                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>ASSIGNED SQUAD</span>
                        <select
                          value={selectedPrd.squadId || ''}
                          onChange={(e) => handleUpdatePrd(selectedPrd.id, { squadId: e.target.value || undefined }, true)}
                          style={{
                            background: 'var(--cp-bg-3)',
                            border: '1px solid var(--cp-border)',
                            color: 'var(--foreground)',
                            fontSize: '11px',
                            padding: '4px',
                            outline: 'none'
                          }}
                        >
                          <option value="">UNASSIGNED</option>
                          {(config?.squads || []).map(squad => (
                            <option key={squad.id} value={squad.id}>
                              {squad.name.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>REQUIREMENTS</span>
                        <textarea
                          value={selectedPrd.content}
                          onChange={(e) => handleUpdatePrd(selectedPrd.id, { content: e.target.value })}
                          onBlur={() => handleUpdatePrd(selectedPrd.id, {})}
                          rows={8}
                          style={{
                            background: 'var(--cp-bg-3)',
                            border: '1px solid var(--cp-border)',
                            color: 'var(--foreground)',
                            fontSize: '11px',
                            padding: '6px',
                            outline: 'none',
                            fontFamily: 'monospace',
                            resize: 'vertical'
                          }}
                        />
                      </label>

                      {/* Linked Tickets Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>LINKED JIRA TICKETS</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTicketToEdit(null)
                              setIsAddTicketModalOpen(true)
                            }}
                            style={{
                              background: 'rgba(0, 229, 255, 0.1)',
                              border: '1px solid var(--cp-cyan)',
                              color: 'var(--cp-cyan)',
                              fontSize: '9px',
                              fontFamily: "'Share Tech Mono', monospace",
                              padding: '1px 4px',
                              cursor: 'pointer'
                            }}
                          >
                            + ADD TICKET
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {tickets.filter(t => t.prd_id === selectedPrd.id).length === 0 ? (
                            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                              No tickets linked to this PRD.
                            </span>
                          ) : (
                            tickets.filter(t => t.prd_id === selectedPrd.id).map(ticket => (
                              <div 
                                key={ticket.ticket_id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'var(--cp-bg-3)',
                                  border: '1px solid var(--cp-border)',
                                  padding: '4px 6px',
                                  fontSize: '11px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                  <span style={{ color: 'var(--section-label)', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>
                                    {ticket.ticket_key}
                                  </span>
                                  <span style={{ color: 'var(--foreground)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '120px' }} title={ticket.title}>
                                    {ticket.title.replace(/\[SP-\d+\]\s*/i, '')}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ color: 'var(--cp-green)', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>
                                    {ticket.story_points} SP
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedTicketToEdit(ticket)
                                      setIsAddTicketModalOpen(true)
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--cp-cyan)',
                                      cursor: 'pointer',
                                      padding: '2px',
                                      display: 'grid',
                                      placeItems: 'center',
                                      marginRight: '4px'
                                    }}
                                    title="Edit Ticket"
                                  >
                                    <Edit size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      const updated = { ...ticket, prd_id: undefined }
                                      setTickets(prev => prev.map(t => t.ticket_id === ticket.ticket_id ? updated : t))
                                      await updateTicketLocal(serverUrl, updated)
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--cp-magenta)',
                                      cursor: 'pointer',
                                      padding: '2px',
                                      display: 'grid',
                                      placeItems: 'center'
                                    }}
                                    title="Unlink Ticket"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <select
                          value=""
                          onChange={async (e) => {
                            const val = e.target.value
                            if (!val) return
                            const ticket = tickets.find(t => t.ticket_id === val)
                            if (ticket) {
                              const updated = { ...ticket, prd_id: selectedPrd.id }
                              setTickets(prev => prev.map(t => t.ticket_id === val ? updated : t))
                              await updateTicketLocal(serverUrl, updated)
                            }
                          }}
                          style={{
                            background: 'var(--cp-bg-3)',
                            border: '1px dashed var(--cp-cyan)',
                            color: 'var(--cp-cyan)',
                            fontSize: '11px',
                            padding: '4px',
                            marginTop: '4px',
                            outline: 'none',
                            fontFamily: "'Share Tech Mono', monospace",
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">+ LINK TICKET...</option>
                          {tickets.filter(t => t.prd_id !== selectedPrd.id).map(ticket => (
                            <option key={ticket.ticket_id} value={ticket.ticket_id}>
                              {ticket.ticket_key} - {ticket.title.substring(0, 30)}...
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", marginTop: '4px' }}>
                        Last updated: {new Date(selectedPrd.lastUpdated).toLocaleString()}
                      </div>
                      {selectedPrd.confluenceUrl && (
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); alert(`Opening wiki link: ${selectedPrd.confluenceUrl}`) }}
                          style={{ color: 'var(--cp-cyan)', fontSize: '10px', textDecoration: 'underline' }}
                        >
                          Confluence Space URL
                        </a>
                      )}
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
                  <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
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
                  <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
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

                    {(() => {
                      const currentSprintTickets = (selectedDevStats?.assignedTickets || []).filter(
                        (ticket) => currentSprint && ticket.sprint_id === currentSprint.id
                      )
                      const futureSprintTickets = (selectedDevStats?.assignedTickets || []).filter(
                        (ticket) => !currentSprint || ticket.sprint_id !== currentSprint.id
                      )
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '6px', borderBottom: '1px solid var(--cp-border)', paddingBottom: '4px' }}>
                              CURRENT SPRINT WORKLOAD ({currentSprintTickets.length})
                            </div>
                            <MiniJiraBoard
                              tickets={currentSprintTickets}
                              onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
                            />
                          </div>

                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '6px', borderBottom: '1px solid var(--cp-border)', paddingBottom: '4px' }}>
                              FUTURE SPRINTS & BACKLOG ({futureSprintTickets.length})
                            </div>
                            <MiniJiraBoard
                              tickets={futureSprintTickets}
                              onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
                            />
                          </div>
                        </div>
                      )
                    })()}

                    <div style={{ marginTop: '4px', borderTop: '1px solid var(--cp-border)', paddingTop: '12px' }}>
                      {(() => {
                        const devEvents = availabilityEvents.filter(e => e.developer_id === selectedDeveloper.id)
                        if (devEvents.length > 0) {
                          return (
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ fontSize: '11px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '6px' }}>
                                SCHEDULED TIME OFF ({devEvents.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {devEvents.map(event => (
                                  <div
                                    key={event.id}
                                    style={{
                                      background: 'var(--cp-bg-2)',
                                      border: '1px solid var(--cp-border)',
                                      padding: '8px 10px',
                                      fontSize: '11px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{
                                          color: event.type === 'sick' ? 'var(--cp-magenta)' : event.type === 'pto' ? 'var(--cp-cyan)' : 'var(--cp-green)',
                                          fontFamily: "'Share Tech Mono', monospace",
                                          fontSize: '10px',
                                          textTransform: 'uppercase',
                                          background: event.type === 'sick' ? 'rgba(255, 0, 170, 0.1)' : event.type === 'pto' ? 'rgba(0, 229, 255, 0.1)' : 'rgba(0, 255, 136, 0.1)',
                                          border: event.type === 'sick' ? '1px solid rgba(255, 0, 170, 0.3)' : event.type === 'pto' ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(0, 255, 136, 0.3)',
                                          padding: '1px 4px',
                                          borderRadius: '2px'
                                        }}>
                                          {event.type}
                                        </span>
                                        <strong style={{ color: 'var(--foreground)' }}>{event.title}</strong>
                                      </div>
                                      <div style={{ color: 'var(--muted-foreground)', fontSize: '10px' }}>
                                        {event.start_date === event.end_date ? event.start_date : `${event.start_date} to ${event.end_date}`}
                                      </div>
                                      {event.notes && (
                                        <div style={{ color: 'var(--muted-foreground)', fontStyle: 'italic', fontSize: '10px' }}>
                                          Note: {event.notes}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAvailabilityEvent(event.id)}
                                      title="Delete vacation event"
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--cp-magenta)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'grid',
                                        placeItems: 'center',
                                        opacity: 0.8
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return null
                      })()}

                      <div style={{ fontSize: '11px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '6px' }}>
                        // SCHEDULE TIME OFF / VACATION
                      </div>
                      <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <label style={{ display: 'grid', gap: '2px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Type</span>
                            <select
                              value={devVacationType}
                              onChange={(e) => {
                                const val = e.target.value as 'vacation' | 'sick' | 'pto'
                                setDevVacationType(val)
                                setDevVacationTitle(val.charAt(0).toUpperCase() + val.slice(1))
                              }}
                              style={{ background: 'var(--cp-bg-3)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', padding: '4px', fontSize: '11px', outline: 'none' }}
                            >
                              <option value="vacation">Vacation</option>
                              <option value="sick">Sick</option>
                              <option value="pto">PTO</option>
                            </select>
                          </label>
                          <label style={{ display: 'grid', gap: '2px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Title</span>
                            <input
                              type="text"
                              value={devVacationTitle}
                              onChange={(e) => setDevVacationTitle(e.target.value)}
                              placeholder="e.g. Summer Leave"
                              style={{ background: 'var(--cp-bg-3)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', padding: '4px 6px', fontSize: '11px', outline: 'none' }}
                            />
                          </label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <label style={{ display: 'grid', gap: '2px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Start Date</span>
                            <input
                              type="date"
                              value={devVacationStart}
                              onChange={(e) => setDevVacationStart(e.target.value)}
                              onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
                              style={{ background: 'var(--cp-bg-3)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', padding: '4px', fontSize: '11px', outline: 'none' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: '2px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>End Date</span>
                            <input
                              type="date"
                              value={devVacationEnd}
                              onChange={(e) => setDevVacationEnd(e.target.value)}
                              onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
                              style={{ background: 'var(--cp-bg-3)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', padding: '4px', fontSize: '11px', outline: 'none' }}
                            />
                          </label>
                        </div>
                        <label style={{ display: 'grid', gap: '2px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>Notes (Optional)</span>
                          <input
                            type="text"
                            value={devVacationNotes}
                            onChange={(e) => setDevVacationNotes(e.target.value)}
                            placeholder="e.g. Out of office, offline"
                            style={{ background: 'var(--cp-bg-3)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', padding: '4px 6px', fontSize: '11px', outline: 'none' }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!devVacationTitle.trim()) return
                            handleAddAvailabilityEvent({
                              developer_id: selectedDeveloper.id,
                              type: devVacationType,
                              title: devVacationTitle.trim(),
                              start_date: devVacationStart,
                              end_date: devVacationEnd,
                              notes: devVacationNotes.trim() || undefined
                            })
                            setDevVacationNotes('')
                          }}
                          style={{
                            background: 'rgba(0, 255, 136, 0.08)',
                            border: '1px solid rgba(0, 255, 136, 0.35)',
                            color: 'var(--cp-green)',
                            padding: '6px 12px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontFamily: "'Share Tech Mono', monospace",
                            textTransform: 'uppercase'
                          }}
                        >
                          <Plus size={12} />
                          Add Time Off
                        </button>
                      </div>
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
                  tickets={squadScopedTickets}
                  onCreateSprint={handleCreateSprint}
                  onSetCurrentSprint={handleSetCurrentSprint}
                  onCompleteSprint={handleCompleteSprint}
                  onAddAvailabilityEvent={handleAddAvailabilityEvent}
                  onUpdateTicket={handleUpdateTicket}
                />
              )}

              {rightPanelTab === 'sprint-future' && (
                <SprintWorkbenchPanel
                  mode="future"
                  activeSquad={activeSquad}
                  history={squadStatsHistory}
                  latest={latestSquadSnapshot}
                  sprintPlans={sprintPlans}
                  currentSprint={currentSprint}
                  availabilityEvents={availabilityEvents}
                  tickets={squadScopedTickets}
                  onCreateSprint={handleCreateSprint}
                  onSetCurrentSprint={handleSetCurrentSprint}
                  onCompleteSprint={handleCompleteSprint}
                  onAddAvailabilityEvent={handleAddAvailabilityEvent}
                  onUpdateTicket={handleUpdateTicket}
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
                  tickets={squadScopedTickets}
                  onCreateSprint={handleCreateSprint}
                  onSetCurrentSprint={handleSetCurrentSprint}
                  onCompleteSprint={handleCompleteSprint}
                  onAddAvailabilityEvent={handleAddAvailabilityEvent}
                  onUpdateTicket={handleUpdateTicket}
                />
              )}

              {rightPanelTab === 'ticket-inspector' && (
                selectedTicket ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", fontWeight: 'bold', fontSize: '14px' }}>
                          {selectedTicket.ticket_key}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={() => {
                              setSelectedTicketToEdit(selectedTicket)
                              setIsAddTicketModalOpen(true)
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(0, 229, 255, 0.4)',
                              color: 'var(--cp-cyan)',
                              fontSize: '9px',
                              fontFamily: "'Share Tech Mono', monospace",
                              padding: '1px 4px',
                              cursor: 'pointer'
                            }}
                          >
                            EDIT TICKET
                          </button>
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
                              opacity: selectedTicket.assignee ? 1 : 0.3,
                              cursor: 'pointer'
                            }}
                          >
                            UNASSIGN
                          </button>
                          {!selectedTicket.assignee && (
                            <button 
                              onClick={() => handleDeleteTicket(selectedTicket.ticket_id)}
                              style={{
                                background: 'transparent',
                                border: '1px solid rgba(255, 34, 68, 0.4)',
                                color: '#ff2244',
                                fontSize: '9px',
                                fontFamily: "'Share Tech Mono', monospace",
                                padding: '1px 4px',
                                cursor: 'pointer'
                              }}
                            >
                              DELETE
                            </button>
                          )}
                        </div>
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
                        <span style={{ color: 'var(--muted-foreground)' }}>PRD Link:</span>
                        <select
                          value={selectedTicket.prd_id || ''}
                          onChange={async (e) => {
                            const updated = { ...selectedTicket, prd_id: e.target.value || undefined }
                            setTickets(prev => prev.map(t => t.ticket_id === selectedTicket.ticket_id ? updated : t))
                            await updateTicketLocal(runtime.serverUrl, updated)
                          }}
                          style={{ background: 'var(--cp-bg-3)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', outline: 'none', fontSize: '11px', maxWidth: '140px' }}
                        >
                          <option value="">None</option>
                          {prds.map(prd => (
                            <option key={prd.id} value={prd.id}>
                              {prd.title}
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
                        <div style={{ fontSize: '11px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", marginBottom: '4px' }}>
                          ASSIGNED OWNER METRICS
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
                  <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
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
                  <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
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
                  <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
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
            <button
              className={`nav-icon ${rightPanelOpen && rightPanelTab === 'athena-chat' && !isThreadBrowserOpen ? 'active' : ''}`}
              onClick={() => {
                if (rightPanelOpen && rightPanelTab === 'athena-chat' && !isThreadBrowserOpen) {
                  setRightPanelOpen(false)
                } else {
                  setIsThreadBrowserOpen(false)
                  setRightPanelTab('athena-chat')
                  setRightPanelOpen(true)
                }
              }}
              title="Athena Chat"
            >
              <Sparkles size={16} />
              <span className="rail-label-text">athena chat</span>
            </button>
            <button
              className={`nav-icon ${rightPanelOpen && rightPanelTab === 'athena-chat' && isThreadBrowserOpen ? 'active' : ''}`}
              onClick={() => {
                if (rightPanelOpen && rightPanelTab === 'athena-chat' && isThreadBrowserOpen) {
                  setRightPanelOpen(false)
                } else {
                  setIsThreadBrowserOpen(true)
                  setRightPanelTab('athena-chat')
                  setRightPanelOpen(true)
                }
              }}
              title="Chat History"
            >
              <History size={16} />
              <span className="rail-label-text">history</span>
            </button>
            {activeTab === 'projects' && isProjectDrawerOpen && (
              <>
                <button
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'project-features' ? 'active' : ''}`}
                  onClick={() => {
                    handleRightRailClick('project-features')
                  }}
                  title={selectedPmProject ? `Features in ${selectedPmProject.name}` : 'Project features'}
                >
                  <Tag size={16} />
                  <span className="rail-label-text">features</span>
                </button>
                <button 
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'project-prds' ? 'active' : ''}`}
                  onClick={() => {
                    handleRightRailClick('project-prds')
                  }}
                  title={selectedPmProject ? `PRDs in ${selectedPmProject.name}` : 'Project PRDs'}
                >
                  <FileText size={16} />
                  <span className="rail-label-text">prds</span>
                </button>
                <button 
                  className="nav-icon"
                  onClick={() => {
                    if (!selectedPmProject) return
                    if (confirm(`Delete ${selectedPmProject.name}?`)) {
                      setProjectActionSignal({ type: 'delete', projectId: selectedPmProject.id, nonce: Date.now() })
                    }
                  }}
                  title={selectedPmProject ? `Delete ${selectedPmProject.name}` : 'Delete project'}
                >
                  <Trash2 size={16} />
                  <span className="rail-label-text">delete</span>
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
                  className={`nav-icon ${rightPanelOpen && rightPanelTab === 'sprint-future' ? 'active' : ''}`}
                  onClick={() => handleRightRailClick('sprint-future')}
                  title="Future Sprint Planning"
                >
                  <CalendarDays size={16} />
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
      <AddTicketModal
        isOpen={isAddTicketModalOpen}
        onClose={() => {
          setIsAddTicketModalOpen(false)
          setSelectedTicketToEdit(null)
        }}
        onCreate={handleCreateTicketFromPRD}
        onUpdate={handleUpdateTicketFromModal}
        ticket={selectedTicketToEdit}
      />
      {isCreatePrdModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.65)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div style={{ width: 'min(760px, 96vw)', background: 'var(--cp-bg-1)', border: '1px solid var(--cp-border)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--cp-bg-2)' }}>
              <span style={{ fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.12em', color: 'var(--section-label)', textTransform: 'uppercase' }}>
                NEW PRD
              </span>
              <button
                type="button"
                onClick={() => setIsCreatePrdModalOpen(false)}
                style={{ background: 'transparent', border: 0, color: 'var(--muted-foreground)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const title = (form.elements.namedItem('title') as HTMLInputElement | null)?.value || ''
                const content = (form.elements.namedItem('content') as HTMLTextAreaElement | null)?.value || ''
                handleCreatePrdFromModal({ title, content })
              }}
              style={{ padding: '16px', display: 'grid', gap: '12px' }}
            >
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)' }}>TITLE</span>
                <input
                  name="title"
                  type="text"
                  defaultValue=""
                  placeholder="PRD title"
                  style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--foreground)', padding: '8px 10px', fontSize: '12px', outline: 'none' }}
                />
              </label>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)' }}>CONTENT</span>
                <textarea
                  name="content"
                  rows={14}
                  defaultValue="# New PRD\n\n## Overview\n\n## Goals\n\n## User Stories\n\n## Acceptance Criteria\n"
                  placeholder="PRD content"
                  style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--foreground)', padding: '8px 10px', fontSize: '12px', outline: 'none', fontFamily: 'monospace', resize: 'vertical' }}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreatePrdModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--cp-border)', color: 'var(--muted-foreground)', padding: '8px 12px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px' }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid var(--cp-cyan)', color: 'var(--cp-cyan)', padding: '8px 12px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px' }}
                >
                  CREATE PRD
                </button>
              </div>
            </form>
          </div>
        </div>
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
      await window.system?.killAthenaRun?.(runId)
      updateAthenaRun(runId, (run) => ({ ...run, status: 'error', endedAt: new Date().toISOString() }))
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

  function handleClearRuns() {
    const remaining = runs.filter((run) => !filteredRuns.some((fr) => fr.id === run.id))
    saveAthenaRuns(remaining)
    setRuns(remaining)
    setSelectedRunId(null)
    setSelectedRunEvents(null)
    window.dispatchEvent(new Event('savant-forge-prompt-runs-changed'))
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
              <span>FORGE PROMPT TRACKER</span>
            </div>
            <button onClick={() => setIsOpen(false)} title="Close prompt tracker" aria-label="Close prompt tracker">
              <X size={14} />
            </button>
          </div>

          <div className="prompt-tracker-body">
            <div className="prompt-run-list">
              <div className="prompt-pane-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Run Registry</span>
                {filteredRuns.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearRuns}
                    title="Clear all tracks"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 34, 68, 0.35)',
                      color: 'var(--cp-magenta)',
                      fontSize: '9px',
                      fontFamily: "'Share Tech Mono', monospace",
                      padding: '1px 6px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      transition: 'all 0.2s ease',
                      borderRadius: '2px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 34, 68, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 34, 68, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'rgba(255, 34, 68, 0.35)';
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>
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

                  {selectedRun?.prompt && (
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--cp-border)',
                      padding: '8px 10px',
                      fontSize: '11px',
                      fontFamily: "'Share Tech Mono', monospace",
                      maxHeight: '80px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: 'var(--foreground)'
                    }}>
                      <div style={{ color: 'var(--cp-cyan)', fontSize: '9px', textTransform: 'uppercase', marginBottom: '4px' }}>&gt; Prompt Sent:</div>
                      {selectedRun.prompt}
                    </div>
                  )}

                  <div className="prompt-terminal">
                    <div className="prompt-terminal-head">
                      <span>execution event log</span>
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
