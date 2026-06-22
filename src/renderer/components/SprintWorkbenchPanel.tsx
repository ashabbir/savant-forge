import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Activity, AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock3, FileText, Plus, Users, Zap } from 'lucide-react'
import type {
  AvailabilityEvent,
  JiraTicket,
  Squad,
  SquadSnapshot,
  SprintPlan
} from '../services/localState'

type SprintWorkbenchPanelProps = {
  activeSquad: Squad | undefined
  history: SquadSnapshot[]
  latest: SquadSnapshot | null
  sprintPlans: SprintPlan[]
  currentSprint: SprintPlan | null
  availabilityEvents: AvailabilityEvent[]
  tickets: JiraTicket[]
  onCreateSprint: (draft: { name: string; start_date: string; end_date: string; goal: string }) => void
  onSetCurrentSprint: (sprintId: string) => void
  onCompleteSprint: (sprintId: string) => void
  onAddAvailabilityEvent: (draft: {
    developer_id: string
    type: AvailabilityEvent['type']
    title: string
    start_date: string
    end_date: string
    notes?: string
  }) => void
}

export function SprintWorkbenchPanel({
  activeSquad,
  history,
  latest,
  sprintPlans,
  currentSprint,
  availabilityEvents,
  tickets,
  onCreateSprint,
  onSetCurrentSprint,
  onCompleteSprint,
  onAddAvailabilityEvent
}: SprintWorkbenchPanelProps) {
  const [sprintName, setSprintName] = useState(currentSprint?.name || '')
  const [sprintStart, setSprintStart] = useState(currentSprint?.start_date || todayString())
  const [sprintEnd, setSprintEnd] = useState(currentSprint?.end_date || plusDays(13))
  const [sprintGoal, setSprintGoal] = useState('Deliver planned scope')
  const [availabilityDeveloper, setAvailabilityDeveloper] = useState(activeSquad?.developers[0]?.id || '')
  const [availabilityType, setAvailabilityType] = useState<AvailabilityEvent['type']>('vacation')
  const [availabilityTitle, setAvailabilityTitle] = useState('Vacation')
  const [availabilityStart, setAvailabilityStart] = useState(todayString())
  const [availabilityEnd, setAvailabilityEnd] = useState(todayString())
  const [availabilityNotes, setAvailabilityNotes] = useState('')

  const current = currentSprint || sprintPlans.find((plan) => plan.status === 'current') || null
  const upcoming = useMemo(
    () => sprintPlans.filter((plan) => plan.id !== current?.id).sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [current?.id, sprintPlans]
  )

  const sprintWorkload = current
    ? tickets.filter((ticket) => ticket.status !== 'done').reduce((acc, ticket) => acc + ticket.story_points, 0)
    : 0

  const deliveryRate = latest ? Math.round((latest.delivered_points / Math.max(latest.assigned_points || 1, 1)) * 100) : 0
  const historyTrend = history.length >= 2
    ? latest && history[history.length - 2]
      ? latest.delivered_points - history[history.length - 2].delivered_points
      : 0
    : 0

  const squadLoad = latest ? Math.round(latest.load_ratio * 100) : 0
  const capacityBuffer = latest ? Math.max(0, Math.round(((latest.total_effective_capacity - latest.assigned_points) / Math.max(latest.total_effective_capacity || 1, 1)) * 100)) : 0

  const compareDevelopers = useMemo(() => {
    if (!latest) return []
    return [...latest.developers].sort((a, b) => b.utilization - a.utilization)
  }, [latest])

  const reportTotals = useMemo(() => {
    const delivered = tickets.filter((ticket) => ticket.status === 'done').reduce((acc, ticket) => acc + ticket.story_points, 0)
    const open = tickets.filter((ticket) => ticket.status !== 'done').reduce((acc, ticket) => acc + ticket.story_points, 0)
    const byAssignee = new Map<string, number>()
    tickets.forEach((ticket) => {
      if (!ticket.assignee) return
      byAssignee.set(ticket.assignee, (byAssignee.get(ticket.assignee) || 0) + ticket.story_points)
    })
    return { delivered, open, byAssignee }
  }, [tickets])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
      <Header
        title="// SPRINT WORKBENCH"
        subtitle="Future sprint planning, current sprint control, reports, charts, and availability"
        icon={Activity}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
        <Metric label="Current Sprint" value={current ? current.name : 'None'} helper={current ? `${current.start_date} to ${current.end_date}` : 'no active sprint set'} />
        <Metric label="Squad Load" value={`${squadLoad}%`} helper={latest ? `${latest.assigned_points} SP of ${latest.total_effective_capacity.toFixed(0)} SP` : 'waiting on squad snapshot'} />
        <Metric label="Delivery Rate" value={`${deliveryRate}%`} helper={historyTrend >= 0 ? `${historyTrend} SP trend` : `${Math.abs(historyTrend)} SP drop`} />
        <Metric label="Capacity Buffer" value={`${capacityBuffer}%`} helper="safe work left after assigned scope" />
      </div>

      <Band title="Sprint Planning" icon={CalendarDays}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: '12px' }}>
          <section style={sectionStyle}>
            <Subhead title="Create Future Sprint" />
            <div style={{ display: 'grid', gap: '8px' }}>
              <Field label="Sprint name" value={sprintName} onChange={setSprintName} placeholder="Sprint 16" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                <Field label="Start date" value={sprintStart} onChange={setSprintStart} type="date" />
                <Field label="End date" value={sprintEnd} onChange={setSprintEnd} type="date" />
              </div>
              <Field label="Primary goal" value={sprintGoal} onChange={setSprintGoal} placeholder="Ship availability-aware planning" />
              <button
                onClick={() => {
                  if (!sprintName.trim()) return
                  onCreateSprint({
                    name: sprintName.trim(),
                    start_date: sprintStart,
                    end_date: sprintEnd,
                    goal: sprintGoal.trim()
                  })
                  setSprintName('')
                  setSprintGoal('Deliver planned scope')
                }}
                style={primaryButtonStyle}
              >
                <Plus size={14} />
                Create sprint
              </button>
            </div>
          </section>

          <section style={sectionStyle}>
            <Subhead title="Current Sprint" />
            {current ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{current.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                      {current.start_date} → {current.end_date}
                    </div>
                  </div>
                  <Badge label={current.status.toUpperCase()} />
                </div>
                <Bar value={squadLoad} tone={squadLoad > 100 ? 'danger' : squadLoad >= 80 ? 'warning' : 'good'} />
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                  Sprint workload: {sprintWorkload} SP open, {latest?.delivered_points || 0} SP delivered, {latest?.carryover_points || 0} SP carryover
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {current.goals.map((goal) => (
                    <span key={goal.id} style={goalChipStyle(goal.status)}>
                      {goal.title}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => onCompleteSprint(current.id)} style={secondaryButtonStyle}>
                    <CheckCircle2 size={14} />
                    Mark complete
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState text="No current sprint selected." />
            )}
          </section>
        </div>
      </Band>

      <Band title="Sprint Report" icon={BarChart3}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
          <Metric label="Delivered" value={`${latest?.delivered_points || 0} SP`} helper={`${deliveryRate}% of assigned`} />
          <Metric label="Open" value={`${latest?.open_points || 0} SP`} helper="unfinished sprint scope" />
          <Metric label="Carryover" value={`${latest?.carryover_points || 0} SP`} helper="work that crossed snapshots" />
          <Metric label="Overdue" value={`${latest?.overdue_points || 0} SP`} helper="open work beyond safe capacity" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '12px' }}>
          <section style={sectionStyle}>
            <Subhead title="History" />
            <div style={{ display: 'grid', gap: '8px' }}>
              {history.slice(-10).reverse().map((snapshot) => (
                <div key={snapshot.id} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) 48px', gap: '8px', alignItems: 'center' }}>
                  <span style={monoLabelStyle}>{new Date(snapshot.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <Bar value={Math.min(100, Math.round(snapshot.load_ratio * 100))} tone={snapshot.status === 'overloaded' ? 'danger' : snapshot.status === 'warning' ? 'warning' : 'good'} />
                  <span style={monoLabelStyle}>{Math.round(snapshot.load_ratio * 100)}%</span>
                </div>
              ))}
            </div>
          </section>
          <section style={sectionStyle}>
            <Subhead title="Project Report" />
            <MiniStat label="Total Delivered" value={`${reportTotals.delivered} SP`} />
            <MiniStat label="Open Work" value={`${reportTotals.open} SP`} />
            <MiniStat label="Backlog Ratio" value={`${Math.round((reportTotals.open / Math.max((reportTotals.delivered + reportTotals.open) || 1, 1)) * 100)}%`} />
            <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
              <Bar value={Math.min(100, Math.round((reportTotals.delivered / Math.max((reportTotals.delivered + reportTotals.open) || 1, 1)) * 100))} tone="good" />
              <Bar value={Math.min(100, Math.round((reportTotals.open / Math.max((reportTotals.delivered + reportTotals.open) || 1, 1)) * 100))} tone="warning" />
            </div>
          </section>
        </div>
      </Band>

      <Band title="User Report" icon={Users}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '12px' }}>
          <section style={sectionStyle}>
            <Subhead title="Developer Comparison" />
            <div style={{ display: 'grid', gap: '8px' }}>
              {compareDevelopers.length ? compareDevelopers.map((dev) => (
                <div key={dev.developer_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(120px, 1fr) 56px', gap: '8px', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--foreground)' }}>{dev.developer_name}</strong>
                      <Badge label={dev.workload_label} />
                    </div>
                    <div style={subtleLabelStyle}>{dev.region} · {dev.ranking}</div>
                  </div>
                  <Bar value={Math.min(100, Math.round(dev.utilization * 100))} tone={dev.workload_label === 'OVERWORKED' ? 'danger' : dev.workload_label === 'NORMAL' ? 'warning' : 'good'} />
                  <div style={{ textAlign: 'right', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: 'var(--foreground)' }}>
                    {Math.round(dev.utilization * 100)}%
                  </div>
                </div>
              )) : <EmptyState text="No developer data available." />}
            </div>
          </section>

          <section style={sectionStyle}>
            <Subhead title="Availability" />
            <MiniStat label="Developers" value={`${activeSquad?.developers.length || 0}`} />
            <MiniStat label="Events" value={`${availabilityEvents.length}`} />
            <MiniStat label="Scheduled PTO / Sick" value={`${availabilityEvents.filter((event) => event.type !== 'pto').length}`} />
            <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
              {availabilityEvents.slice(-4).reverse().map((event) => (
                <div key={event.id} style={eventRowStyle}>
                  <div>
                    <div style={{ color: 'var(--foreground)', fontWeight: 'bold' }}>{event.title}</div>
                    <div style={subtleLabelStyle}>{event.start_date} → {event.end_date}</div>
                  </div>
                  <Badge label={event.type.toUpperCase()} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </Band>

      <Band title="Current People" icon={Zap}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '12px' }}>
          <section style={sectionStyle}>
            <Subhead title="Availability Event" />
            <div style={{ display: 'grid', gap: '8px' }}>
              <Field label="Developer" value={availabilityDeveloper} onChange={setAvailabilityDeveloper} asSelect options={activeSquad?.developers.map((dev) => ({ value: dev.id, label: dev.name })) || []} />
              <Field label="Type" value={availabilityType} onChange={(value) => setAvailabilityType(value as AvailabilityEvent['type'])} asSelect options={[
                { value: 'vacation', label: 'Vacation' },
                { value: 'sick', label: 'Sick' },
                { value: 'pto', label: 'PTO' }
              ]} />
              <Field label="Title" value={availabilityTitle} onChange={setAvailabilityTitle} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                <Field label="Start" value={availabilityStart} onChange={setAvailabilityStart} type="date" />
                <Field label="End" value={availabilityEnd} onChange={setAvailabilityEnd} type="date" />
              </div>
              <Field label="Notes" value={availabilityNotes} onChange={setAvailabilityNotes} placeholder="Optional note" />
              <button
                onClick={() => {
                  if (!availabilityDeveloper || !availabilityTitle.trim()) return
                  onAddAvailabilityEvent({
                    developer_id: availabilityDeveloper,
                    type: availabilityType,
                    title: availabilityTitle.trim(),
                    start_date: availabilityStart,
                    end_date: availabilityEnd,
                    notes: availabilityNotes.trim() || undefined
                  })
                  setAvailabilityNotes('')
                }}
                style={primaryButtonStyle}
              >
                <Plus size={14} />
                Add event
              </button>
            </div>
          </section>

          <section style={sectionStyle}>
            <Subhead title="Sprint Queue" />
            <div style={{ display: 'grid', gap: '8px' }}>
              {upcoming.length ? upcoming.map((plan) => (
                <div key={plan.id} style={eventRowStyle}>
                  <div>
                    <div style={{ color: 'var(--foreground)', fontWeight: 'bold' }}>{plan.name}</div>
                    <div style={subtleLabelStyle}>{plan.start_date} → {plan.end_date}</div>
                    <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--muted-foreground)' }}>{plan.goals.length} goals</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <Badge label={plan.status.toUpperCase()} />
                    <button onClick={() => onSetCurrentSprint(plan.id)} style={secondaryButtonStyle}>
                      Set current
                    </button>
                  </div>
                </div>
              )) : <EmptyState text="No future sprint plans yet." />}
            </div>
          </section>
        </div>
      </Band>

      <Band title="Squad Report" icon={FileText}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
          <Metric label="Delivered Workload" value={`${latest?.delivered_points || 0} SP`} helper="squad output" />
          <Metric label="Carryover Workload" value={`${latest?.carryover_points || 0} SP`} helper="unfinished work from previous snapshots" />
          <Metric label="Forecast Capacity" value={`${latest?.available_capacity || latest?.total_effective_capacity || 0} SP`} helper="capacity after working days and leave" />
        </div>
      </Band>
    </div>
  )
}

function Header({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon: typeof Activity }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
      <div>
        <span style={monoLabelStyle}>{title}</span>
        <h2 style={{ margin: '4px 0 0', fontSize: '18px', color: 'var(--cp-cyan)', fontFamily: "'Orbitron', sans-serif" }}>{subtitle}</h2>
      </div>
      <div style={statusPillStyle}>
        <Icon size={12} />
        LIVE
      </div>
    </div>
  )
}

function Band({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: ReactNode }) {
  return (
    <section style={sectionStyle}>
      <div style={bandHeaderStyle}>
        <Icon size={13} />
        {title}
      </div>
      {children}
    </section>
  )
}

function Subhead({ title }: { title: string }) {
  return (
    <div style={{ fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {title}
    </div>
  )
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div style={metricStyle}>
      <div style={monoLabelStyle}>{label}</div>
      <div style={{ marginTop: '4px', fontSize: '15px', fontWeight: 'bold', color: 'var(--foreground)' }}>{value}</div>
      <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--muted-foreground)' }}>{helper}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px' }}>
      <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <strong style={{ color: 'var(--foreground)' }}>{value}</strong>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  asSelect = false,
  options = []
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  asSelect?: boolean
  options?: Array<{ value: string; label: string }>
}) {
  return (
    <label style={{ display: 'grid', gap: '4px' }}>
      <span style={monoLabelStyle}>{label}</span>
      {asSelect ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} style={inputStyle} />
      )}
    </label>
  )
}

function Bar({ value, tone }: { value: number; tone: 'good' | 'warning' | 'danger' }) {
  const color = tone === 'danger'
    ? 'linear-gradient(90deg, #ff2244, #ff8800)'
    : tone === 'warning'
    ? 'linear-gradient(90deg, #ffe600, #ffaa00)'
    : 'linear-gradient(90deg, #00ff88, #00e5ff)'

  return (
    <div style={{ height: '8px', background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: color }} />
    </div>
  )
}

function Badge({ label }: { label: string }) {
  const tone = label === 'OVERWORKED'
    ? { color: 'var(--cp-magenta)', background: 'rgba(255, 34, 68, 0.08)' }
    : label === 'NORMAL'
    ? { color: 'var(--cp-yellow)', background: 'rgba(255, 230, 0, 0.06)' }
    : label === 'HAPPY' || label === 'CURRENT'
    ? { color: 'var(--cp-green)', background: 'rgba(0, 255, 136, 0.06)' }
    : { color: 'var(--muted-foreground)', background: 'rgba(255,255,255,0.04)' }

  return (
    <span style={{ ...badgeStyle, color: tone.color, background: tone.background }}>
      {label}
    </span>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace" }}>
      {text}
    </div>
  )
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function plusDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function goalChipStyle(status: string) {
  const tone = status === 'done'
    ? { color: 'var(--cp-green)', background: 'rgba(0, 255, 136, 0.06)' }
    : status === 'blocked'
    ? { color: 'var(--cp-magenta)', background: 'rgba(255, 34, 68, 0.08)' }
    : { color: 'var(--cp-yellow)', background: 'rgba(255, 230, 0, 0.06)' }
  return {
    border: '1px solid var(--cp-border)',
    padding: '2px 6px',
    fontSize: '9px',
    fontFamily: "'Share Tech Mono', monospace",
    color: tone.color,
    background: tone.background
  }
}

const sectionStyle: CSSProperties = {
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-2)',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px'
}

const metricStyle: CSSProperties = {
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-2)',
  padding: '10px'
}

const monoLabelStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--muted-foreground)',
  fontFamily: "'Share Tech Mono', monospace",
  textTransform: 'uppercase'
}

const subtleLabelStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--muted-foreground)',
  fontFamily: "'Share Tech Mono', monospace"
}

const bandHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '10px',
  color: 'var(--cp-cyan)',
  fontFamily: "'Share Tech Mono', monospace",
  textTransform: 'uppercase'
}

const statusPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  border: '1px solid var(--cp-border)',
  background: 'rgba(0, 255, 136, 0.06)',
  color: 'var(--cp-green)',
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '10px',
  fontWeight: 'bold'
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 6px',
  border: '1px solid var(--cp-border)',
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '9px',
  fontWeight: 'bold'
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-3)',
  color: 'var(--foreground)',
  padding: '8px 9px',
  fontSize: '12px',
  outline: 'none'
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: '1px solid var(--cp-border)',
  background: 'rgba(0, 229, 255, 0.08)',
  color: 'var(--cp-cyan)',
  padding: '8px 10px',
  fontSize: '11px',
  fontFamily: "'Share Tech Mono', monospace",
  textTransform: 'uppercase',
  cursor: 'pointer'
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-3)',
  color: 'var(--foreground)',
  padding: '7px 10px',
  fontSize: '11px',
  fontFamily: "'Share Tech Mono', monospace",
  cursor: 'pointer'
}

const eventRowStyle: CSSProperties = {
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-3)',
  padding: '10px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center'
}
