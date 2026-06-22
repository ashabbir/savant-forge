import { checkServerHealth, getStoredApiKey, setStoredApiKey } from './savantClient'

// Define types for local state storage
export interface Developer {
  id: string
  name: string
  specialty: 'Backend' | 'Frontend' | 'Cloud Infra' | string
  specialty_tags?: SpecialtyTag[]
  ranking: 'Junior' | 'Mid' | 'Senior' | 'Principal' | string
  raw_capacity: number // in Story Points
  region: string
  working_days: string[]
  timezone: string
}

export interface Squad {
  id: string
  name: string
  developers: Developer[]
}

export interface ForgeConfig {
  active_squad_id: string
  current_project_id?: string
  current_sprint_id?: string
  squads: Squad[]
  buffer_threshold: number
  theme: string
  athena_provider?: string
  athena_model?: string
  company_holidays_by_region?: Record<string, CompanyHoliday[]>
  workdays?: string[]
}

export interface JiraTicket {
  ticket_id: string
  workspace_id: string
  ticket_key: string
  title: string
  project_id?: string
  epic_ticket_id?: string
  parent_ticket_id?: string
  issue_type?: 'epic' | 'story' | 'task'
  health_status?: 'green' | 'yellow' | 'red'
  start_date?: string
  end_date?: string
  status: 'todo' | 'in_progress' | 'done' | string
  priority: 'low' | 'medium' | 'high' | string
  assignee: string // maps to Developer.id (or name) or empty
  reporter: string
  story_points: number // defaults to 0 or parsed from ticket
  sprint_id?: string
}

export type WorkingDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface CompanyHoliday {
  id: string
  region: string
  name: string
  date: string
  recurring?: boolean
}

export interface AvailabilityEvent {
  id: string
  developer_id: string
  type: 'vacation' | 'sick' | 'pto'
  title: string
  start_date: string
  end_date: string
  notes?: string
  created_at: string
}

export interface SprintGoal {
  id: string
  title: string
  description: string
  status: 'planned' | 'active' | 'done' | 'blocked'
}

export interface SprintPlan {
  id: string
  squad_id: string
  name: string
  start_date: string
  end_date: string
  status: 'planned' | 'current' | 'complete'
  goals: SprintGoal[]
  created_at: string
  updated_at: string
}

export interface ProjectEntity {
  id: string
  name: string
  description: string
  health_status: 'green' | 'yellow' | 'red'
  start_date: string
  end_date: string
  epic_ticket_id?: string
  created_at: string
  updated_at: string
}

export type SpecialtyScore = 'low' | 'medium' | 'high'

export interface SpecialtyTag {
  label: string
  score: SpecialtyScore
}

const STORAGE_CONFIG_KEY = 'savant_forge_config'
const STORAGE_TICKETS_KEY = 'savant_forge_tickets'
const STORAGE_SYNC_QUEUE_KEY = 'savant_forge_sync_queue'
const STORAGE_SQUAD_STATS_KEY = 'savant_forge_squad_stats'
const STORAGE_AVAILABILITY_KEY = 'savant_forge_availability'
const STORAGE_SPRINTS_KEY = 'savant_forge_sprints'
const STORAGE_PROJECTS_KEY = 'savant_forge_projects'

const DEFAULT_WORKING_DAYS: WorkingDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

// Load Master configuration
export async function getForgeConfig(): Promise<ForgeConfig> {
  const local = localStorage.getItem(STORAGE_CONFIG_KEY)
  if (local) {
    try {
      const parsed = JSON.parse(local)
      // Migration: if the local storage config does not have 'NY' or 'lisbon', force clear local storage config to reload new defaults
      if (!parsed.company_holidays_by_region || (!parsed.company_holidays_by_region.NY && !parsed.company_holidays_by_region.lisbon)) {
        localStorage.removeItem(STORAGE_CONFIG_KEY)
      } else {
        return normalizeForgeConfig(parsed)
      }
    } catch {
      // fallback
    }
  }

  // Load from bundle public directory as fallback/first-load
  try {
    const res = await fetch('./forge_config.json')
    if (res.ok) {
      const data = await res.json()
      const normalized = normalizeForgeConfig(data)
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(normalized))
      return normalized
    }
  } catch (e) {
    console.error('Failed to load default config, using code fallback:', e)
  }

  return normalizeForgeConfig({
    active_squad_id: 'squad-alpha',
    current_project_id: '',
    squads: [],
    buffer_threshold: 0.8,
    theme: 'olympus',
    current_sprint_id: '',
    company_holidays_by_region: {
      "NY": [
        { id: "holiday-ny-1", region: "NY", name: "New Year's Day", date: "2026-01-01", recurring: true },
        { id: "holiday-ny-2", region: "NY", name: "Memorial Day", date: "2026-05-25", recurring: true },
        { id: "holiday-ny-3", region: "NY", name: "Independence Day", date: "2026-07-04", recurring: true },
        { id: "holiday-ny-4", region: "NY", name: "Labor Day", date: "2026-09-07", recurring: true },
        { id: "holiday-ny-5", region: "NY", name: "Thanksgiving", date: "2026-11-26", recurring: true },
        { id: "holiday-ny-6", region: "NY", name: "Christmas Day", date: "2026-12-25", recurring: true }
      ],
      "lisbon": [
        { id: "holiday-pt-1", region: "lisbon", name: "Ano Novo", date: "2026-01-01", recurring: true },
        { id: "holiday-pt-2", region: "lisbon", name: "Dia de Portugal", date: "2026-06-10", recurring: true },
        { id: "holiday-pt-3", region: "lisbon", name: "Santo António", date: "2026-06-13", recurring: true },
        { id: "holiday-pt-4", region: "lisbon", name: "Assunção de Nossa Senhora", date: "2026-08-15", recurring: true },
        { id: "holiday-pt-5", region: "lisbon", name: "Imaculada Conceição", date: "2026-12-08", recurring: true },
        { id: "holiday-pt-6", region: "lisbon", name: "Natal", date: "2026-12-25", recurring: true }
      ]
    }
  })
}

export function saveForgeConfig(config: ForgeConfig) {
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(normalizeForgeConfig(config)))
}

export type SquadSnapshotDeveloper = {
  developer_id: string
  developer_name: string
  ranking: string
  specialty: string
  specialty_tags?: SpecialtyTag[]
  region: string
  working_days: string[]
  timezone: string
  raw_capacity: number
  effective_capacity: number
  availability_ratio: number
  available_days: number
  planned_days: number
  company_holidays: number
  personal_time_off: number
  assigned_points: number
  delivered_points: number
  open_points: number
  overdue_points: number
  carryover_points: number
  utilization: number
  workload_label: 'FREE' | 'HAPPY' | 'NORMAL' | 'OVERWORKED'
}

export type SquadSnapshot = {
  id: string
  squad_id: string
  squad_name: string
  sprint_id?: string
  sprint_name?: string
  captured_at: string
  total_raw_capacity: number
  total_effective_capacity: number
  available_capacity: number
  assigned_points: number
  delivered_points: number
  open_points: number
  overdue_points: number
  carryover_points: number
  velocity: number
  load_ratio: number
  status: 'safe' | 'warning' | 'overloaded'
  developers: SquadSnapshotDeveloper[]
}

export function getSquadStatsHistory(): SquadSnapshot[] {
  const stored = localStorage.getItem(STORAGE_SQUAD_STATS_KEY)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.map((snapshot) => normalizeSquadSnapshot(snapshot)) : []
  } catch {
    return []
  }
}

export function saveSquadStatsSnapshot(snapshot: SquadSnapshot) {
  const history = getSquadStatsHistory()
  const next = [...history, normalizeSquadSnapshot(snapshot)].slice(-60)
  localStorage.setItem(STORAGE_SQUAD_STATS_KEY, JSON.stringify(next))
}

export function getAvailabilityEvents(): AvailabilityEvent[] {
  const stored = localStorage.getItem(STORAGE_AVAILABILITY_KEY)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveAvailabilityEvent(event: AvailabilityEvent) {
  const current = getAvailabilityEvents()
  const existing = current.find((item) => item.id === event.id)
  const next = existing ? current.map((item) => item.id === event.id ? event : item) : [...current, event]
  localStorage.setItem(STORAGE_AVAILABILITY_KEY, JSON.stringify(next))
}

export function getSprintPlans(): SprintPlan[] {
  const stored = localStorage.getItem(STORAGE_SPRINTS_KEY)
  if (!stored) {
    const seed = seedSprintPlans()
    localStorage.setItem(STORAGE_SPRINTS_KEY, JSON.stringify(seed))
    return seed
  }
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    const seed = seedSprintPlans()
    localStorage.setItem(STORAGE_SPRINTS_KEY, JSON.stringify(seed))
    return seed
  }
}

export function saveSprintPlan(plan: SprintPlan) {
  const current = getSprintPlans()
  const existing = current.find((item) => item.id === plan.id)
  const next = existing ? current.map((item) => item.id === plan.id ? plan : item) : [...current, plan]
  localStorage.setItem(STORAGE_SPRINTS_KEY, JSON.stringify(next))
}

export function setCurrentSprintPlan(sprintId: string) {
  const config = getStoredForgeConfig()
  saveForgeConfig({ ...config, current_sprint_id: sprintId })
}

export function getCurrentSprintPlan(): SprintPlan | null {
  const config = getStoredForgeConfig()
  if (!config.current_sprint_id) return null
  return getSprintPlans().find((plan) => plan.id === config.current_sprint_id) || null
}

export function getProjectEntities(): ProjectEntity[] {
  const stored = localStorage.getItem(STORAGE_PROJECTS_KEY)
  if (!stored) {
    const seed = seedProjectEntities()
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(seed))
    return seed
  }
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.map((project) => normalizeProjectEntity(project)) : []
  } catch {
    const seed = seedProjectEntities()
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(seed))
    return seed
  }
}

export function saveProjectEntity(project: ProjectEntity) {
  const current = getProjectEntities()
  const existing = current.find((item) => item.id === project.id)
  const next = existing ? current.map((item) => item.id === project.id ? project : item) : [...current, project]
  localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(next))
}

export function setCurrentProjectEntity(projectId: string) {
  const config = getStoredForgeConfig()
  saveForgeConfig({ ...config, current_project_id: projectId })
}

export function getCurrentProjectEntity(): ProjectEntity | null {
  const config = getStoredForgeConfig()
  if (!config.current_project_id) return null
  return getProjectEntities().find((project) => project.id === config.current_project_id) || null
}

export function recordSprintSnapshot(
  squad: Squad | undefined,
  tickets: JiraTicket[],
  options: { capturedAt?: string } = {}
) {
  const config = getStoredForgeConfig()
  const snapshot = buildSquadSnapshot(squad, tickets, {
    workspaceId: config.active_squad_id || 'squad-alpha',
    existingHistory: getSquadStatsHistory(),
    capturedAt: options.capturedAt
  })
  if (snapshot) {
    saveSquadStatsSnapshot(snapshot)
  }
  return snapshot
}

export function buildSquadSnapshot(
  squad: Squad | undefined,
  tickets: JiraTicket[],
  options: { workspaceId: string; existingHistory?: SquadSnapshot[]; capturedAt?: string }
): SquadSnapshot | null {
  if (!squad) return null
  const config = getStoredForgeConfig()
  const sprint = getCurrentSprintPlan()
  const referenceDate = options.capturedAt ? new Date(options.capturedAt) : new Date()
  const sprintStart = sprint ? new Date(sprint.start_date) : startOfWeek(referenceDate)
  const sprintEnd = sprint ? new Date(sprint.end_date) : endOfWeek(referenceDate)

  const effectiveCapacity = squad.developers.reduce((acc, dev) => acc + dev.raw_capacity * 0.8, 0)
  const totalRawCapacity = squad.developers.reduce((acc, dev) => acc + dev.raw_capacity, 0)
  const assignedTickets = tickets.filter((ticket) => squad.developers.some((dev) => dev.id === ticket.assignee))
  const deliveredTickets = assignedTickets.filter((ticket) => ticket.status === 'done')
  const openTickets = assignedTickets.filter((ticket) => ticket.status !== 'done')
  const deliveredPoints = deliveredTickets.reduce((acc, ticket) => acc + ticket.story_points, 0)
  const openPoints = openTickets.reduce((acc, ticket) => acc + ticket.story_points, 0)
  const overduePoints = Math.max(0, openPoints - effectiveCapacity)
  const carryoverPoints = computeCarryoverPoints(options.existingHistory || [], assignedTickets)
  const assignedPoints = assignedTickets.reduce((acc, ticket) => acc + ticket.story_points, 0)
  const loadRatio = effectiveCapacity > 0 ? assignedPoints / effectiveCapacity : 0
  const velocity = computeVelocity(options.existingHistory || [], assignedTickets)
  const availabilityWindow = getAvailabilityWindow(sprintStart, sprintEnd)
  const availableCapacity = squad.developers.reduce((acc, dev) => {
    const availability = computeDeveloperAvailability(dev, config, availabilityWindow, options.capturedAt)
    return acc + availability.available_capacity
  }, 0)
  const status: SquadSnapshot['status'] = loadRatio > 1
    ? 'overloaded'
    : loadRatio >= 0.8
    ? 'warning'
    : 'safe'

  const developers: SquadSnapshotDeveloper[] = squad.developers.map((dev) => {
    const devTickets = tickets.filter((ticket) => ticket.assignee === dev.id)
    const devDelivered = devTickets.filter((ticket) => ticket.status === 'done')
    const devOpen = devTickets.filter((ticket) => ticket.status !== 'done')
    const devAssignedPoints = devTickets.reduce((acc, ticket) => acc + ticket.story_points, 0)
    const devDeliveredPoints = devDelivered.reduce((acc, ticket) => acc + ticket.story_points, 0)
    const devOpenPoints = devOpen.reduce((acc, ticket) => acc + ticket.story_points, 0)
    const devCarryoverPoints = computeDeveloperCarryover(options.existingHistory || [], dev.id, devTickets)
    const availability = computeDeveloperAvailability(dev, config, availabilityWindow, options.capturedAt)
    const utilization = availability.available_capacity > 0 ? devAssignedPoints / availability.available_capacity : 0
    const workload_label: SquadSnapshotDeveloper['workload_label'] = devAssignedPoints <= 0
      ? 'FREE'
      : utilization > 1
      ? 'OVERWORKED'
      : utilization >= 0.8
      ? 'NORMAL'
      : 'HAPPY'

    return {
      developer_id: dev.id,
      developer_name: dev.name,
      ranking: dev.ranking,
      specialty: dev.specialty,
      region: dev.region,
      working_days: dev.working_days,
      timezone: dev.timezone,
      raw_capacity: dev.raw_capacity,
      effective_capacity: availability.available_capacity,
      availability_ratio: availability.availability_ratio,
      available_days: availability.available_days,
      planned_days: availability.planned_days,
      company_holidays: availability.company_holidays,
      personal_time_off: availability.personal_time_off,
      assigned_points: devAssignedPoints,
      delivered_points: devDeliveredPoints,
      open_points: devOpenPoints,
      overdue_points: Math.max(0, devOpenPoints - availability.available_capacity),
      carryover_points: devCarryoverPoints,
      utilization,
      workload_label
    }
  })

  return {
    id: `${options.workspaceId}-${Date.now()}`,
    squad_id: squad.id,
    squad_name: squad.name,
    sprint_id: sprint?.id,
    sprint_name: sprint?.name,
    captured_at: options.capturedAt || new Date().toISOString(),
    total_raw_capacity: totalRawCapacity,
    total_effective_capacity: effectiveCapacity,
    available_capacity: availableCapacity,
    assigned_points: assignedPoints,
    delivered_points: deliveredPoints,
    open_points: openPoints,
    overdue_points: overduePoints,
    carryover_points: carryoverPoints,
    velocity,
    load_ratio: loadRatio,
    status,
    developers
  }
}

function computeVelocity(history: SquadSnapshot[], tickets: JiraTicket[]) {
  const previous = history.slice(-5)
  const deltas = previous.map((snapshot) => snapshot.delivered_points)
  const currentDelivered = tickets.filter((ticket) => ticket.status === 'done').reduce((acc, ticket) => acc + ticket.story_points, 0)
  if (deltas.length === 0) return currentDelivered
  const baseline = deltas.reduce((acc, value) => acc + value, 0) / deltas.length
  return Math.round((baseline + currentDelivered) / 2)
}

function computeCarryoverPoints(history: SquadSnapshot[], tickets: JiraTicket[]) {
  if (history.length === 0) return 0
  const previous = history[history.length - 1]
  const previousIds = new Set(previous.developers.flatMap((dev) => dev.assigned_points > 0 ? [dev.developer_id] : []))
  return tickets
    .filter((ticket) => ticket.status !== 'done' && ticket.assignee && previousIds.has(ticket.assignee))
    .reduce((acc, ticket) => acc + ticket.story_points, 0)
}

function computeDeveloperCarryover(history: SquadSnapshot[], developerId: string, tickets: JiraTicket[]) {
  if (history.length === 0) return 0
  const previous = history[history.length - 1]
  const previousDeveloper = previous.developers.find((dev) => dev.developer_id === developerId)
  if (!previousDeveloper) return 0
  return tickets
    .filter((ticket) => ticket.status !== 'done' && ticket.assignee === developerId)
    .reduce((acc, ticket) => acc + ticket.story_points, 0)
}

function getStoredForgeConfig(): ForgeConfig {
  const local = localStorage.getItem(STORAGE_CONFIG_KEY)
  if (local) {
    try {
      return normalizeForgeConfig(JSON.parse(local))
    } catch {
      //
    }
  }
  return normalizeForgeConfig({
    active_squad_id: 'squad-alpha',
    squads: [],
    buffer_threshold: 0.8,
    theme: 'olympus',
    current_sprint_id: '',
    company_holidays_by_region: {}
  })
}

function computeDeveloperAvailability(
  dev: Developer,
  config: ForgeConfig,
  window: Date[],
  capturedAt?: string
) {
  const plannedDays = window.filter((date) => dev.working_days.includes(formatWeekday(date))).length
  const regionHolidays = (config.company_holidays_by_region?.[dev.region] || []).filter((holiday) => {
    return window.some((date) => formatDate(date) === holiday.date)
  })
  const availabilityEvents = getAvailabilityEvents().filter((event) => event.developer_id === dev.id)
  const personalTimeOff = availabilityEvents.filter((event) => {
    return window.some((date) => isWithinRange(date, event.start_date, event.end_date))
  })
  const blockedDays = regionHolidays.length + countEventDays(personalTimeOff)
  const availableDays = Math.max(0, plannedDays - blockedDays)
  const availabilityRatio = plannedDays > 0 ? availableDays / plannedDays : 1
  const sprintLength = Math.max(1, window.length)
  const sprintCapacity = dev.raw_capacity * 0.8
  const available_capacity = sprintCapacity * availabilityRatio

  return {
    planned_days: plannedDays,
    available_days: availableDays,
    company_holidays: regionHolidays.length,
    personal_time_off: personalTimeOff.length,
    availability_ratio: availabilityRatio,
    available_capacity,
    sprint_length: sprintLength,
    captured_at: capturedAt
  }
}

function getAvailabilityWindow(start: Date, end: Date) {
  const window: Date[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    window.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return window
}

function countEventDays(events: AvailabilityEvent[]) {
  return events.reduce((total, event) => {
    const start = new Date(event.start_date)
    const end = new Date(event.end_date)
    let count = 0
    const cursor = new Date(start)
    while (cursor <= end) {
      count += 1
      cursor.setDate(cursor.getDate() + 1)
    }
    return total + count
  }, 0)
}

function startOfWeek(date: Date) {
  const result = new Date(date)
  const day = result.getDay() || 7
  result.setDate(result.getDate() - day + 1)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfWeek(date: Date) {
  const result = startOfWeek(date)
  result.setDate(result.getDate() + 13)
  result.setHours(23, 59, 59, 999)
  return result
}

function formatWeekday(date: Date): WorkingDay {
  const weekdays: WorkingDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return weekdays[date.getDay()]
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isWithinRange(date: Date, start: string, end: string) {
  const current = formatDate(date)
  return current >= start && current <= end
}

function normalizeForgeConfig(config: Partial<ForgeConfig>): ForgeConfig {
  const squads = Array.isArray(config.squads) ? config.squads.map((squad) => ({
    ...squad,
    developers: Array.isArray(squad.developers) ? squad.developers.map((dev) => normalizeDeveloper(dev as Partial<Developer>)) : []
  })) : []
  return {
    active_squad_id: config.active_squad_id || 'squad-alpha',
    current_project_id: config.current_project_id || '',
    current_sprint_id: config.current_sprint_id || '',
    squads,
    buffer_threshold: typeof config.buffer_threshold === 'number' ? config.buffer_threshold : 0.8,
    theme: config.theme || 'olympus',
    athena_provider: config.athena_provider || 'codex',
    athena_model: config.athena_model || 'gpt-5-codex',
    company_holidays_by_region: normalizeHolidayMap(config.company_holidays_by_region),
    workdays: Array.isArray(config.workdays) ? config.workdays : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  }
}

function normalizeProjectEntity(project: Partial<ProjectEntity>): ProjectEntity {
  return {
    id: project.id || `project_${Math.random().toString(36).slice(2, 8)}`,
    name: project.name || 'Project',
    description: project.description || '',
    health_status: project.health_status || 'green',
    start_date: project.start_date || new Date().toISOString().slice(0, 10),
    end_date: project.end_date || new Date().toISOString().slice(0, 10),
    epic_ticket_id: project.epic_ticket_id || '',
    created_at: project.created_at || new Date().toISOString(),
    updated_at: project.updated_at || new Date().toISOString()
  }
}

function normalizeSpecialtyTags(
  tags: Array<Partial<SpecialtyTag> | undefined> | undefined,
  legacySpecialty?: string
): SpecialtyTag[] {
  const cleaned = Array.isArray(tags)
    ? tags
        .filter(Boolean)
        .map((tag) => ({
          label: (tag?.label || '').trim(),
          score: normalizeSpecialtyScore(tag?.score)
        }))
        .filter((tag) => tag.label.length > 0)
    : []

  if (cleaned.length > 0) return cleaned

  const label = (legacySpecialty || '').trim()
  return [
    {
      label: label || 'backend/rails',
      score: 'medium'
    }
  ]
}

function describeSpecialties(tags: SpecialtyTag[]) {
  return tags.map((tag) => `${tag.label} ${tag.score}`).join(' · ')
}

function normalizeSpecialtyScore(score: unknown): SpecialtyScore {
  if (score === 'low' || score === 'medium' || score === 'high') return score
  return 'medium'
}

function normalizeDeveloper(dev: Partial<Developer>): Developer {
  const specialtyTags = normalizeSpecialtyTags(
    Array.isArray((dev as Partial<Developer> & { specialty_tags?: Array<Partial<SpecialtyTag>> }).specialty_tags)
      ? (dev as Partial<Developer> & { specialty_tags?: Array<Partial<SpecialtyTag>> }).specialty_tags
      : undefined,
    dev.specialty
  )
  return {
    id: dev.id || `dev_${Math.random().toString(36).slice(2, 8)}`,
    name: dev.name || 'Developer',
    specialty: describeSpecialties(specialtyTags),
    specialty_tags: specialtyTags,
    ranking: dev.ranking || 'Mid',
    raw_capacity: typeof dev.raw_capacity === 'number' ? dev.raw_capacity : 30,
    region: dev.region || 'global',
    working_days: Array.isArray(dev.working_days) && dev.working_days.length > 0 ? dev.working_days : DEFAULT_WORKING_DAYS,
    timezone: dev.timezone || 'UTC'
  }
}

function normalizeHolidayMap(map?: Record<string, CompanyHoliday[]>) {
  const source = map && typeof map === 'object' ? map : {}
  return Object.fromEntries(
    Object.entries(source).map(([region, holidays]) => [
      region,
      Array.isArray(holidays)
        ? holidays.map((holiday) => ({
            id: holiday.id || `holiday_${Math.random().toString(36).slice(2, 8)}`,
            region: holiday.region || region,
            name: holiday.name || 'Holiday',
            date: holiday.date || new Date().toISOString().slice(0, 10),
            recurring: Boolean(holiday.recurring)
          }))
        : []
    ])
  )
}

function normalizeSquadSnapshot(snapshot: Partial<SquadSnapshot>): SquadSnapshot {
  return {
    id: snapshot.id || `snapshot_${Date.now()}`,
    squad_id: snapshot.squad_id || 'squad-alpha',
    squad_name: snapshot.squad_name || 'Squad',
    sprint_id: snapshot.sprint_id || '',
    sprint_name: snapshot.sprint_name || '',
    captured_at: snapshot.captured_at || new Date().toISOString(),
    total_raw_capacity: snapshot.total_raw_capacity || 0,
    total_effective_capacity: snapshot.total_effective_capacity || 0,
    available_capacity: snapshot.available_capacity || 0,
    assigned_points: snapshot.assigned_points || 0,
    delivered_points: snapshot.delivered_points || 0,
    open_points: snapshot.open_points || 0,
    overdue_points: snapshot.overdue_points || 0,
    carryover_points: snapshot.carryover_points || 0,
    velocity: snapshot.velocity || 0,
    load_ratio: snapshot.load_ratio || 0,
    status: snapshot.status || 'safe',
    developers: Array.isArray(snapshot.developers)
      ? snapshot.developers.map((developer) => ({
          developer_id: developer.developer_id || '',
          developer_name: developer.developer_name || 'Developer',
          ranking: developer.ranking || 'Mid',
          specialty_tags: normalizeSpecialtyTags(
            Array.isArray((developer as Partial<SquadSnapshotDeveloper>).specialty_tags)
              ? (developer as Partial<SquadSnapshotDeveloper>).specialty_tags
              : undefined,
            developer.specialty
          ),
          specialty: describeSpecialties(
            normalizeSpecialtyTags(
              Array.isArray((developer as Partial<SquadSnapshotDeveloper>).specialty_tags)
                ? (developer as Partial<SquadSnapshotDeveloper>).specialty_tags
                : undefined,
              developer.specialty
            )
          ),
          region: developer.region || 'global',
          working_days: Array.isArray(developer.working_days) && developer.working_days.length ? developer.working_days : DEFAULT_WORKING_DAYS,
          timezone: developer.timezone || 'UTC',
          raw_capacity: developer.raw_capacity || 0,
          effective_capacity: developer.effective_capacity || 0,
          availability_ratio: developer.availability_ratio || 1,
          available_days: developer.available_days || 0,
          planned_days: developer.planned_days || 0,
          company_holidays: developer.company_holidays || 0,
          personal_time_off: developer.personal_time_off || 0,
          assigned_points: developer.assigned_points || 0,
          delivered_points: developer.delivered_points || 0,
          open_points: developer.open_points || 0,
          overdue_points: developer.overdue_points || 0,
          carryover_points: developer.carryover_points || 0,
          utilization: developer.utilization || 0,
          workload_label: developer.workload_label || 'FREE'
        }))
      : []
  }
}

function seedSprintPlans(): SprintPlan[] {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay() + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 13)
  const nextStart = new Date(end)
  nextStart.setDate(end.getDate() + 1)
  const nextEnd = new Date(nextStart)
  nextEnd.setDate(nextStart.getDate() + 13)

  return [
    {
      id: 'sprint-alpha-current',
      squad_id: 'squad-alpha',
      name: 'Alpha Sprint 14',
      start_date: formatDate(start),
      end_date: formatDate(end),
      status: 'current',
      goals: [
        { id: 'goal-alpha-1', title: 'Ship planner', description: 'Bring sprint planning and availability into Forge', status: 'active' },
        { id: 'goal-alpha-2', title: 'Stabilize load math', description: 'Preserve capacity buffer while accounting for leaves', status: 'planned' }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sprint-alpha-next',
      squad_id: 'squad-alpha',
      name: 'Alpha Sprint 15',
      start_date: formatDate(nextStart),
      end_date: formatDate(nextEnd),
      status: 'planned',
      goals: [
        { id: 'goal-alpha-3', title: 'User report board', description: 'Compare engineers, squad delivery, and forecast drift', status: 'planned' },
        { id: 'goal-alpha-4', title: 'Project velocity chart', description: 'Track missed, delivered, and carryover work by sprint', status: 'planned' }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]
}

function seedProjectEntities(): ProjectEntity[] {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 7)
  const end = new Date(today)
  end.setDate(today.getDate() + 21)
  return [
    {
      id: 'project-forge-core',
      name: 'Forge Core',
      description: 'Blueprints, tickets, squad planning, and delivery tracking.',
      health_status: 'green',
      start_date: formatDate(start),
      end_date: formatDate(end),
      epic_ticket_id: 'JIRA-101',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]
}

// Fetch Jira tickets from server or offline cache
export async function fetchJiraTickets(serverUrl: string, workspaceId: string): Promise<JiraTicket[]> {
  const apiKey = getStoredApiKey()
  const hasNetwork = navigator.onLine

  if (hasNetwork && apiKey) {
    try {
      const res = await fetch(`${serverUrl}/api/jira-tickets?workspace_id=${workspaceId}`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(3500)
      })
      if (res.ok) {
        const rawList = await res.json()
        const parsedList: JiraTicket[] = rawList.map((t: any) => ({
          ticket_id: t.ticket_id,
          workspace_id: t.workspace_id || workspaceId,
          ticket_key: t.ticket_key,
          title: t.title || '',
          status: t.status || 'todo',
          priority: t.priority || 'medium',
          assignee: t.assignee || '',
          reporter: t.reporter || '',
          // Extract SP from title like "[SP-5] title" or default to 5 or parse description/metadata if present
          story_points: parseStoryPoints(t)
        }))

        // Cache local state
        localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(parsedList))
        return parsedList
      }
    } catch (e) {
      console.warn('Network request failed, reading offline Jira tickets cache:', e)
    }
  }

  // Return local storage fallback
  const cached = localStorage.getItem(STORAGE_TICKETS_KEY)
  if (cached) {
    try {
      return JSON.parse(cached)
    } catch {
      // fallback
    }
  }

  // Generate seed tickets if completely empty
  const seeds: JiraTicket[] = [
    { ticket_id: 't-1', workspace_id: workspaceId, ticket_key: 'JIRA-101', title: '[SP-8] Refactor Auth Middleware', status: 'todo', priority: 'high', assignee: '', reporter: 'admin', story_points: 8 },
    { ticket_id: 't-2', workspace_id: workspaceId, ticket_key: 'JIRA-102', title: '[SP-5] Fix Database Deadlock', status: 'in_progress', priority: 'high', assignee: 'dev-1', reporter: 'admin', story_points: 5 },
    { ticket_id: 't-3', workspace_id: workspaceId, ticket_key: 'JIRA-103', title: '[SP-13] Build Cockpit UI Dashboard', status: 'todo', priority: 'medium', assignee: '', reporter: 'admin', story_points: 13 },
    { ticket_id: 't-4', workspace_id: workspaceId, ticket_key: 'JIRA-104', title: '[SP-3] Add Logging Middleware', status: 'done', priority: 'low', assignee: 'dev-1', reporter: 'admin', story_points: 3 },
    { ticket_id: 't-5', workspace_id: workspaceId, ticket_key: 'JIRA-105', title: '[SP-5] Setup Docker Compose Multi-Node', status: 'todo', priority: 'medium', assignee: 'dev-3', reporter: 'admin', story_points: 5 },
    { ticket_id: 't-6', workspace_id: workspaceId, ticket_key: 'JIRA-106', title: '[SP-2] UI Theme Toggle CSS Fixes', status: 'todo', priority: 'low', assignee: '', reporter: 'admin', story_points: 2 },
    { ticket_id: 't-7', workspace_id: workspaceId, ticket_key: 'JIRA-107', title: '[SP-8] Setup K8s Deployment Pipeline', status: 'todo', priority: 'high', assignee: '', reporter: 'admin', story_points: 8 }
  ]
  localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(seeds))
  return seeds
}

// Utility to parse story points from title or properties
export function parseStoryPoints(t: any): number {
  if (t.story_points !== undefined && typeof t.story_points === 'number') {
    return t.story_points
  }
  // Try parsing from title e.g. [SP-8] or (5 SP) or [5]
  const title = t.title || ''
  const spMatch = title.match(/\[SP-(\d+)\]/i) || title.match(/\[(\d+)\]/) || title.match(/\((\d+)\s*SP\)/i)
  if (spMatch && spMatch[1]) {
    return parseInt(spMatch[1], 10)
  }
  // fallback to priority or default
  if (t.priority === 'high') return 8
  if (t.priority === 'medium') return 5
  return 3
}

// Update ticket status or assignee locally and queue for background sync
export async function updateTicketLocal(serverUrl: string, ticket: JiraTicket): Promise<JiraTicket> {
  const cached = localStorage.getItem(STORAGE_TICKETS_KEY)
  let tickets: JiraTicket[] = []
  if (cached) {
    try {
      tickets = JSON.parse(cached)
    } catch {
      //
    }
  }

  tickets = tickets.map(t => t.ticket_id === ticket.ticket_id ? ticket : t)
  localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(tickets))

  // Queue mutation for server sync
  const queueJson = localStorage.getItem(STORAGE_SYNC_QUEUE_KEY)
  const queue = queueJson ? JSON.parse(queueJson) : []
  queue.push({
    action: 'UPDATE_TICKET',
    ticketId: ticket.ticket_id,
    payload: {
      assignee: ticket.assignee,
      status: ticket.status,
      title: ticket.title,
      priority: ticket.priority
    },
    timestamp: Date.now()
  })
  localStorage.setItem(STORAGE_SYNC_QUEUE_KEY, JSON.stringify(queue))

  // Process sync immediately in background
  triggerSync(serverUrl).catch(console.error)

  return ticket
}

// Create ticket local and sync back
export async function createTicketLocal(serverUrl: string, ticketData: Partial<JiraTicket> & { title: string; ticket_key: string; workspace_id: string }): Promise<JiraTicket> {
  const cached = localStorage.getItem(STORAGE_TICKETS_KEY)
  let tickets: JiraTicket[] = []
  if (cached) {
    try {
      tickets = JSON.parse(cached)
    } catch {
      //
    }
  }

  const newTicket: JiraTicket = {
    ticket_id: ticketData.ticket_id || `jira_${Math.random().toString(36).slice(2, 10)}`,
    workspace_id: ticketData.workspace_id,
    ticket_key: ticketData.ticket_key,
    title: ticketData.title,
    status: ticketData.status || 'todo',
    priority: ticketData.priority || 'medium',
    assignee: ticketData.assignee || '',
    reporter: ticketData.reporter || 'operator',
    story_points: parseStoryPoints(ticketData)
  }

  tickets.push(newTicket)
  localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(tickets))

  // Queue sync
  const queueJson = localStorage.getItem(STORAGE_SYNC_QUEUE_KEY)
  const queue = queueJson ? JSON.parse(queueJson) : []
  queue.push({
    action: 'CREATE_TICKET',
    ticketId: newTicket.ticket_id,
    payload: {
      ticket_id: newTicket.ticket_id,
      workspace_id: newTicket.workspace_id,
      ticket_key: newTicket.ticket_key,
      title: newTicket.title,
      status: newTicket.status,
      priority: newTicket.priority,
      assignee: newTicket.assignee,
      reporter: newTicket.reporter
    },
    timestamp: Date.now()
  })
  localStorage.setItem(STORAGE_SYNC_QUEUE_KEY, JSON.stringify(queue))

  triggerSync(serverUrl).catch(console.error)
  return newTicket
}

// Background sync processor
let isSyncing = false
export async function triggerSync(serverUrl: string) {
  if (isSyncing) return
  const apiKey = getStoredApiKey()
  if (!apiKey || !navigator.onLine) return

  const queueJson = localStorage.getItem(STORAGE_SYNC_QUEUE_KEY)
  if (!queueJson) return
  const queue = JSON.parse(queueJson)
  if (queue.length === 0) return

  isSyncing = true
  console.log(`Sync Engine: Processing ${queue.length} queued mutations...`)

  const remainingQueue = []

  for (const task of queue) {
    try {
      if (task.action === 'UPDATE_TICKET') {
        const res = await fetch(`${serverUrl}/api/jira-tickets/${task.ticketId}`, {
          method: 'PUT',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(task.payload),
          signal: AbortSignal.timeout(3000)
        })
        if (!res.ok) {
          // If 404, maybe ticket doesn't exist on server yet (e.g. was queued for creation). Keep in queue.
          if (res.status === 404) {
            remainingQueue.push(task)
          }
        }
      } else if (task.action === 'CREATE_TICKET') {
        const res = await fetch(`${serverUrl}/api/jira-tickets`, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(task.payload),
          signal: AbortSignal.timeout(3000)
        })
        if (!res.ok) {
          remainingQueue.push(task)
        }
      }
    } catch (e) {
      console.warn('Sync task failed, keeping in offline queue:', e)
      remainingQueue.push(task)
    }
  }

  localStorage.setItem(STORAGE_SYNC_QUEUE_KEY, JSON.stringify(remainingQueue))
  isSyncing = false
}

// PRD document interface
export interface PRDDocument {
  id: string
  title: string
  content: string
  status: 'draft' | 'synced'
  confluenceUrl?: string
  lastUpdated: string
}

const STORAGE_PRD_KEY = 'savant_forge_prds'

export function getLocalPRDs(): PRDDocument[] {
  const data = localStorage.getItem(STORAGE_PRD_KEY)
  if (!data) return []
  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

export function saveLocalPRD(prd: PRDDocument): PRDDocument[] {
  const current = getLocalPRDs()
  const exists = current.find(p => p.id === prd.id)
  let next: PRDDocument[]
  if (exists) {
    next = current.map(p => p.id === prd.id ? prd : p)
  } else {
    next = [...current, prd]
  }
  localStorage.setItem(STORAGE_PRD_KEY, JSON.stringify(next))
  return next
}

export function deleteLocalPRD(prdId: string): PRDDocument[] {
  const current = getLocalPRDs()
  const next = current.filter(p => p.id !== prdId)
  localStorage.setItem(STORAGE_PRD_KEY, JSON.stringify(next))
  return next
}

// Mock push to Confluence
export async function pushToConfluence(prdId: string): Promise<PRDDocument> {
  const current = getLocalPRDs()
  const doc = current.find(p => p.id === prdId)
  if (!doc) throw new Error('PRD not found')
  
  const updated: PRDDocument = {
    ...doc,
    status: 'synced',
    confluenceUrl: `https://confluence.corporate.internal/wiki/spaces/FORGE/pages/${doc.id}`,
    lastUpdated: new Date().toISOString()
  }
  saveLocalPRD(updated)
  return updated
}
