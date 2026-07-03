import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Activity, AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock3, FileText, Plus, Users, Zap, Trash2 } from 'lucide-react'
import type {
  AvailabilityEvent,
  JiraTicket,
  Squad,
  SquadSnapshot,
  SprintPlan
} from '../services/localState'

type SprintWorkbenchPanelProps = {
  mode?: 'current' | 'future' | 'past'
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
  onUpdateTicket?: (ticketId: string, fields: Partial<JiraTicket>) => void
}

export function SprintWorkbenchPanel({
  mode = 'current',
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
  onAddAvailabilityEvent,
  onUpdateTicket
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

  const sprintTickets = useMemo(() => {
    if (!current) return []
    return tickets.filter((ticket) => ticket.sprint_id === current.id)
  }, [current, tickets])

  const backlogTickets = useMemo(() => {
    if (!current) return []
    return tickets.filter((ticket) => ticket.sprint_id !== current.id)
  }, [current, tickets])

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

  const headerDetails = {
    current: {
      title: 'CURRENT SPRINT',
      subtitle: 'Active sprint control, goals checklist, and squad availability',
      icon: Zap
    },
    future: {
      title: 'FUTURE PLANNING',
      subtitle: 'Create upcoming sprints, define goals, and manage the sprint queue',
      icon: CalendarDays
    },
    past: {
      title: 'PAST & PERFORMANCE',
      subtitle: 'Squad delivery statistics, historical snapshot trends, and metrics',
      icon: BarChart3
    }
  }[mode]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
      <Header
        title={headerDetails.title}
        subtitle={headerDetails.subtitle}
        icon={headerDetails.icon}
      />

      {mode === 'current' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
            <Metric label="Current Sprint" value={current ? current.name : 'None'} helper={current ? `${current.start_date} to ${current.end_date}` : 'no active sprint set'} />
            <Metric label="Squad Load" value={`${squadLoad}%`} helper={latest ? `${latest.assigned_points} SP of ${latest.total_effective_capacity.toFixed(0)} SP` : 'waiting on squad snapshot'} />
            <Metric label="Capacity Buffer" value={`${capacityBuffer}%`} helper="safe work left after assigned scope" />
            <Metric label="Active PTOs" value={`${availabilityEvents.length}`} helper="scheduled leave events" />
          </div>

          <Band title="Current Sprint Details" icon={Zap}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <section style={sectionStyle}>
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

          {current && (
            <Band title="Sprint Scope & Tickets" icon={Zap}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {sprintTickets.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontStyle: 'italic', padding: '4px 0' }}>
                      No tickets attached to this sprint yet.
                    </div>
                  ) : (
                    sprintTickets.map((ticket) => (
                      <div
                        key={ticket.ticket_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--cp-bg-3)',
                          border: '1px solid var(--cp-border)',
                          padding: '6px 8px',
                          fontSize: '11px',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
                          <span style={{ color: 'var(--section-label)', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>
                            {ticket.ticket_key}
                          </span>
                          <span style={{ color: 'var(--foreground)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textAlign: 'left' }} title={ticket.title}>
                            {ticket.title.replace(/\[SP-\d+\]\s*/i, '')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <select
                            value={ticket.assignee || ''}
                            onChange={(e) => onUpdateTicket && onUpdateTicket(ticket.ticket_id, { assignee: e.target.value || undefined })}
                            style={{
                              background: 'var(--cp-bg-3)',
                              border: '1px solid var(--cp-border)',
                              color: 'var(--foreground)',
                              fontSize: '10px',
                              padding: '2px 4px',
                              outline: 'none',
                              fontFamily: "'Share Tech Mono', monospace",
                              cursor: 'pointer',
                              maxWidth: '100px'
                            }}
                          >
                            <option value="">Unassigned</option>
                            {activeSquad?.developers.map(dev => (
                              <option key={dev.id} value={dev.id}>
                                {dev.name}
                              </option>
                            ))}
                          </select>
                          <span style={{ color: 'var(--cp-green)', fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace" }}>
                            {ticket.story_points} SP
                          </span>
                          <button
                            onClick={() => onUpdateTicket && onUpdateTicket(ticket.ticket_id, { sprint_id: undefined })}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--cp-magenta)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'grid',
                              placeItems: 'center'
                            }}
                            title="Remove from Sprint"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <select
                  value=""
                  onChange={(e) => {
                    const ticketId = e.target.value
                    if (ticketId && onUpdateTicket) {
                      onUpdateTicket(ticketId, { sprint_id: current.id })
                    }
                  }}
                  style={{
                    background: 'var(--cp-bg-3)',
                    border: '1px dashed var(--cp-cyan)',
                    color: 'var(--cp-cyan)',
                    fontSize: '11px',
                    padding: '6px',
                    outline: 'none',
                    fontFamily: "'Share Tech Mono', monospace",
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  <option value="">+ ATTACH TICKET TO SPRINT...</option>
                  {backlogTickets.map((ticket) => (
                    <option key={ticket.ticket_id} value={ticket.ticket_id}>
                      {ticket.ticket_key} - {ticket.title.substring(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>
            </Band>
          )}

          <Band title="Squad Availability & Leave" icon={Users}>
            <div style={{ display: 'grid', gap: '12px' }}>
              <section style={sectionStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '8px' }}>
                  <MiniStat label="Developers" value={`${activeSquad?.developers.length || 0}`} />
                  <MiniStat label="Events" value={`${availabilityEvents.length}`} />
                  <MiniStat label="Scheduled PTO / Sick" value={`${availabilityEvents.filter((event) => event.type !== 'pto').length}`} />
                </div>
                
                <Subhead title="Current Scheduled Leave & PTO" />
                <div style={{ marginTop: '8px', display: 'grid', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                  {availabilityEvents.length > 0 ? (
                    availabilityEvents.slice().reverse().map((event) => {
                      const devName = activeSquad?.developers.find((d) => d.id === event.developer_id)?.name || 'Unknown'
                      return (
                        <div key={event.id} style={eventRowStyle}>
                          <div>
                            <div style={{ color: 'var(--foreground)', fontWeight: 'bold' }}>
                              {event.title} <span style={{ color: 'var(--section-label)', fontSize: '10px', fontFamily: "'Share Tech Mono', monospace" }}>{devName}</span>
                            </div>
                            <div style={subtleLabelStyle}>{event.start_date} → {event.end_date}</div>
                            {event.notes && (
                              <div style={{ color: 'var(--muted-foreground)', fontSize: '10px', fontStyle: 'italic', marginTop: '2px' }}>
                                Note: {event.notes}
                              </div>
                            )}
                          </div>
                          <Badge label={event.type.toUpperCase()} />
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', padding: '12px 0', textAlign: 'center' }}>
                      No active time off or leaves scheduled for this squad.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </Band>
        </>
      )}

      {mode === 'future' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
            <Metric label="Upcoming Sprints" value={`${upcoming.length}`} helper="future sprints planned" />
            <Metric label="Forecast Capacity" value={`${latest ? latest.total_effective_capacity.toFixed(0) : 0} SP`} helper="average squad capacity limit" />
          </div>

          <Band title="Sprint Planning" icon={CalendarDays}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: '12px' }}>
              <section style={sectionStyle}>
                <Subhead title="Create Future Sprint" />
                <div style={{ display: 'grid', gap: '8px', marginTop: '6px' }}>
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
                <Subhead title="Sprint Queue" />
                <div style={{ display: 'grid', gap: '8px', marginTop: '6px' }}>
                  {upcoming.length ? upcoming.map((plan) => {
                    const planTickets = tickets.filter(t => t.sprint_id === plan.id)
                    return (
                      <div key={plan.id} style={{ ...eventRowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                        {/* Tickets linkage section */}
                        <div style={{ borderTop: '1px solid var(--cp-border)', paddingTop: '6px', marginTop: '4px' }}>
                          <div style={{ fontSize: '9px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>ATTACHED TICKETS ({planTickets.length})</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                            {planTickets.map(ticket => (
                              <div key={ticket.ticket_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', alignItems: 'center', gap: '6px' }}>
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textAlign: 'left' }}>
                                  <strong style={{ color: 'var(--cp-cyan)' }}>{ticket.ticket_key}</strong> {ticket.title.replace(/\[SP-\d+\]\s*/i, '')}
                                </span>
                                <select
                                  value={ticket.assignee || ''}
                                  onChange={(e) => onUpdateTicket && onUpdateTicket(ticket.ticket_id, { assignee: e.target.value || undefined })}
                                  style={{
                                    background: 'var(--cp-bg-3)',
                                    border: '1px solid var(--cp-border)',
                                    color: 'var(--foreground)',
                                    fontSize: '9px',
                                    padding: '1px 2px',
                                    outline: 'none',
                                    fontFamily: "'Share Tech Mono', monospace",
                                    cursor: 'pointer',
                                    maxWidth: '85px'
                                  }}
                                >
                                  <option value="">Unassigned</option>
                                  {activeSquad?.developers.map(dev => (
                                    <option key={dev.id} value={dev.id}>
                                      {dev.name.split(' ')[0]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => onUpdateTicket && onUpdateTicket(ticket.ticket_id, { sprint_id: undefined })}
                                  style={{ background: 'none', border: 'none', color: 'var(--cp-magenta)', cursor: 'pointer', padding: '0 2px' }}
                                >
                                  [x]
                                </button>
                              </div>
                            ))}
                          </div>
                          <select
                            value=""
                            onChange={(e) => {
                              const ticketId = e.target.value
                              if (ticketId && onUpdateTicket) {
                                onUpdateTicket(ticketId, { sprint_id: plan.id })
                              }
                            }}
                            style={{
                              background: 'var(--cp-bg-3)',
                              border: '1px dashed var(--cp-cyan)',
                              color: 'var(--cp-cyan)',
                              fontSize: '9px',
                              padding: '2px',
                              marginTop: '4px',
                              outline: 'none',
                              width: '100%',
                              fontFamily: "'Share Tech Mono', monospace",
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">+ ATTACH TICKET...</option>
                            {tickets.filter(t => t.sprint_id !== plan.id).map(ticket => (
                              <option key={ticket.ticket_id} value={ticket.ticket_id}>
                                {ticket.ticket_key} - {ticket.title.substring(0, 20)}...
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  }) : <EmptyState text="No future sprint plans yet." />}
                </div>
              </section>
            </div>
          </Band>
        </>
      )}

      {mode === 'past' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
            <Metric label="Last Delivery Rate" value={`${deliveryRate}%`} helper={historyTrend >= 0 ? `${historyTrend} SP trend` : `${Math.abs(historyTrend)} SP drop`} />
            <Metric label="Total Delivered" value={`${reportTotals.delivered} SP`} helper="delivered across all sprints" />
            <Metric label="Open Workload" value={`${latest?.open_points || 0} SP`} helper="unfinished sprint scope" />
            <Metric label="Carryover Workload" value={`${latest?.carryover_points || 0} SP`} helper="work that crossed snapshots" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '12px' }}>
            <Band title="Sprint Performance Report" icon={BarChart3}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <section style={sectionStyle}>
                  <Subhead title="Project Report" />
                  <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                    <MiniStat label="Total Delivered" value={`${reportTotals.delivered} SP`} />
                    <MiniStat label="Open Work" value={`${reportTotals.open} SP`} />
                    <MiniStat label="Backlog Ratio" value={`${Math.round((reportTotals.open / Math.max((reportTotals.delivered + reportTotals.open) || 1, 1)) * 100)}%`} />
                    <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
                      <Bar value={Math.min(100, Math.round((reportTotals.delivered / Math.max((reportTotals.delivered + reportTotals.open) || 1, 1)) * 100))} tone="good" />
                      <Bar value={Math.min(100, Math.round((reportTotals.open / Math.max((reportTotals.delivered + reportTotals.open) || 1, 1)) * 100))} tone="warning" />
                    </div>
                  </div>
                </section>
                <section style={sectionStyle}>
                  <Subhead title="Squad Capacity Summary" />
                  <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                    <MiniStat label="Delivered Workload" value={`${latest?.delivered_points || 0} SP`} />
                    <MiniStat label="Carryover Workload" value={`${latest?.carryover_points || 0} SP`} />
                    <MiniStat label="Forecast Capacity" value={`${latest?.available_capacity || latest?.total_effective_capacity || 0} SP`} />
                  </div>
                </section>
              </div>
            </Band>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Band title="Historical Snapshots" icon={Clock3}>
                <section style={sectionStyle}>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {history.slice(-8).reverse().map((snapshot) => (
                      <div key={snapshot.id} style={{ display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr) 48px', gap: '8px', alignItems: 'center' }}>
                        <span style={monoLabelStyle}>{new Date(snapshot.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <Bar value={Math.min(100, Math.round(snapshot.load_ratio * 100))} tone={snapshot.status === 'overloaded' ? 'danger' : snapshot.status === 'warning' ? 'warning' : 'good'} />
                        <span style={monoLabelStyle}>{Math.round(snapshot.load_ratio * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </section>
              </Band>

              <Band title="Developer Utilization" icon={Users}>
                <section style={sectionStyle}>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {compareDevelopers.length ? compareDevelopers.map((dev) => (
                      <div key={dev.developer_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(80px, 1fr) 48px', gap: '8px', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{dev.developer_name}</strong>
                          </div>
                        </div>
                        <Bar value={Math.min(100, Math.round(dev.utilization * 100))} tone={dev.workload_label === 'OVERWORKED' ? 'danger' : dev.workload_label === 'NORMAL' ? 'warning' : 'good'} />
                        <div style={{ textAlign: 'right', fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: 'var(--foreground)' }}>
                          {Math.round(dev.utilization * 100)}%
                        </div>
                      </div>
                    )) : <EmptyState text="No developer data." />}
                  </div>
                </section>
              </Band>
            </div>
          </div>
        </>
      )}
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
    <div style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => { if (type === 'date') { try { event.currentTarget.showPicker(); } catch {} } }}
          placeholder={placeholder}
          type={type}
          style={inputStyle}
        />
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
