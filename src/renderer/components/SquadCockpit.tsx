import { useState, useMemo } from 'react'
import { Frown, Meh, Plus, Smile, Zap, CalendarDays, CheckCircle2, Trash2, Edit, Check, X, AlertTriangle, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { Squad, Developer, JiraTicket, SprintPlan, SprintGoal, PRDDocument } from '../services/localState'
import { SpecialtyTagPills } from './DeveloperSpecialties'

interface SquadCockpitProps {
  activeSquad: Squad | undefined
  squadCapacityStats: {
    totalRaw: number
    totalEffective: number
    assigned: number
    isOverload: boolean
  }
  devLoadStats: Array<{
    dev: Developer
    assignedTickets: JiraTicket[]
    totalPoints: number
    effectiveCapacity: number
    ratio: number
    isOverload: boolean
    statusColor: string
  }>
  selectedDeveloperId: string | null
  setSelectedDeveloperId: (id: string | null) => void
  setSelectedTicketId: (id: string | null) => void
  setSelectedPrdId: (id: string | null) => void
  setRightPanelTab: (tab: string) => void
  setRightPanelOpen: (open: boolean) => void
  assignTicketToDeveloper: (ticketId: string, devId: string) => void
  openAddDeveloperModal: () => void

  // Sprint and Squad Management Props
  sprintPlans: SprintPlan[]
  currentSprint: SprintPlan | null
  onCreateSprint: (draft: { name: string; start_date: string; end_date: string; goal: string }) => void
  onSetCurrentSprint: (sprintId: string) => void
  onCompleteSprint: (sprintId: string) => void
  onUpdateSprintGoals: (sprintId: string, goals: SprintPlan['goals']) => void
  onUpdateSprint: (sprintId: string, fields: Partial<SprintPlan>) => void
  onDeleteSprint: (sprintId: string) => void
  onUpdateSquadName: (squadId: string, newName: string) => void
  onCreateSquad: (name: string) => void

  // PRD Support
  prds?: PRDDocument[]
  onSelectPrd?: (prdId: string) => void
}

export function SquadCockpit({
  activeSquad,
  squadCapacityStats,
  devLoadStats,
  selectedDeveloperId,
  setSelectedDeveloperId,
  setSelectedTicketId,
  setSelectedPrdId,
  setRightPanelTab,
  setRightPanelOpen,
  assignTicketToDeveloper,
  openAddDeveloperModal,
  sprintPlans,
  currentSprint,
  onCreateSprint,
  onSetCurrentSprint,
  onCompleteSprint,
  onUpdateSprintGoals,
  onUpdateSprint,
  onDeleteSprint,
  onUpdateSquadName,
  onCreateSquad,
  prds = [],
  onSelectPrd
}: SquadCockpitProps) {
  // Inline rename squad name state
  const [isRenamingSquad, setIsRenamingSquad] = useState(false)
  const [renameSquadValue, setRenameSquadValue] = useState('')

  // Inline edit active sprint details
  const [isEditingActiveSprint, setIsEditingActiveSprint] = useState(false)
  const [editSprintName, setEditSprintName] = useState('')
  const [editSprintStart, setEditSprintStart] = useState('')
  const [editSprintWorkingDays, setEditSprintWorkingDays] = useState(10)

  // Sprint Creation Form State
  const [newSprintName, setNewSprintName] = useState('')
  const [newSprintStart, setNewSprintStart] = useState(todayString())
  const [newSprintWorkingDays, setNewSprintWorkingDays] = useState(10)
  const [newSprintGoal, setNewSprintGoal] = useState('Deliver planned scope')

  // Goal Inputs mapped by Sprint ID
  const [newGoalInputs, setNewGoalInputs] = useState<Record<string, string>>({})

  // Expanded upcoming sprint ID for details/goals checklist editing
  const [expandedSprintId, setExpandedSprintId] = useState<string | null>(null)

  // Local state to toggle sprint queue panel visibility
  const [isSprintPanelOpen, setIsSprintPanelOpen] = useState(true)

  // Determine working days list from squad developers
  const squadWorkingDays = useMemo(() => {
    if (!activeSquad || activeSquad.developers.length === 0) {
      return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    }
    const days = new Set<string>()
    activeSquad.developers.forEach(d => {
      if (d.working_days) {
        d.working_days.forEach(day => days.add(day.toLowerCase()))
      }
    })
    if (days.size === 0) {
      return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }
    return Array.from(days)
  }, [activeSquad])

  // Filter sprints belonging to the active squad
  const squadSprints = useMemo(() => {
    if (!activeSquad) return []
    return (sprintPlans || []).filter(p => p.squad_id === activeSquad.id)
  }, [activeSquad, sprintPlans])

  // Filter PRDs belonging to the active squad
  const squadPrds = useMemo(() => {
    if (!activeSquad || !prds) return []
    return prds.filter(p => p.squadId === activeSquad.id)
  }, [activeSquad, prds])

  const activeSprint = useMemo(() => {
    return squadSprints.find(p => p.status === 'current') || null
  }, [squadSprints])

  const upcomingSprints = useMemo(() => {
    return squadSprints
      .filter(p => p.status === 'planned')
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
  }, [squadSprints])

  const completedSprints = useMemo(() => {
    return squadSprints
      .filter(p => p.status === 'complete')
      .sort((a, b) => b.end_date.localeCompare(a.end_date))
  }, [squadSprints])

  // Auto-calculated End Date for New Sprint Form
  const newSprintCalculatedEnd = useMemo(() => {
    return getEndDateFromWorkingDays(newSprintStart, newSprintWorkingDays, squadWorkingDays)
  }, [newSprintStart, newSprintWorkingDays, squadWorkingDays])

  // Auto-calculated End Date for Active Sprint edit form
  const editSprintCalculatedEnd = useMemo(() => {
    return getEndDateFromWorkingDays(editSprintStart, editSprintWorkingDays, squadWorkingDays)
  }, [editSprintStart, editSprintWorkingDays, squadWorkingDays])

  // Squad Renaming Actions
  const handleStartRenameSquad = () => {
    if (activeSquad) {
      setRenameSquadValue(activeSquad.name)
      setIsRenamingSquad(true)
    }
  }

  const handleSaveRenameSquad = () => {
    if (activeSquad) {
      if (renameSquadValue.trim()) {
        onUpdateSquadName(activeSquad.id, renameSquadValue.trim())
      }
      setIsRenamingSquad(false)
    }
  }

  // Active Sprint Editing Actions
  const handleStartEditActiveSprint = () => {
    if (activeSprint) {
      setEditSprintName(activeSprint.name)
      setEditSprintStart(activeSprint.start_date)
      const days = calculateWorkingDaysBetween(activeSprint.start_date, activeSprint.end_date, squadWorkingDays)
      setEditSprintWorkingDays(days)
      setIsEditingActiveSprint(true)
    }
  }

  const handleSaveActiveSprint = () => {
    if (activeSprint && editSprintName.trim()) {
      onUpdateSprint(activeSprint.id, {
        name: editSprintName.trim(),
        start_date: editSprintStart,
        end_date: editSprintCalculatedEnd
      })
      setIsEditingActiveSprint(false)
    }
  }

  const handleAutoSaveActiveSprint = (nameVal: string, startVal: string, daysVal: number) => {
    if (activeSprint && nameVal.trim()) {
      const calculatedEnd = getEndDateFromWorkingDays(startVal, daysVal, squadWorkingDays)
      onUpdateSprint(activeSprint.id, {
        name: nameVal.trim(),
        start_date: startVal,
        end_date: calculatedEnd
      })
    }
  }

  // Goal updates
  const handleToggleGoalStatus = (sprint: SprintPlan, goalId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'planned' : 'done'
    const updatedGoals = sprint.goals.map(g =>
      g.id === goalId ? { ...g, status: nextStatus as SprintGoal['status'] } : g
    )
    onUpdateSprintGoals(sprint.id, updatedGoals)
  }

  const handleUpdateGoalStatusVal = (sprint: SprintPlan, goalId: string, newStatus: SprintGoal['status']) => {
    const updatedGoals = sprint.goals.map(g =>
      g.id === goalId ? { ...g, status: newStatus } : g
    )
    onUpdateSprintGoals(sprint.id, updatedGoals)
  }

  const handleDeleteGoal = (sprint: SprintPlan, goalId: string) => {
    const updatedGoals = sprint.goals.filter(g => g.id !== goalId)
    onUpdateSprintGoals(sprint.id, updatedGoals)
  }

  const handleAddGoal = (sprint: SprintPlan) => {
    const text = newGoalInputs[sprint.id] || ''
    if (!text.trim()) return
    const newGoal: SprintGoal = {
      id: `goal_${Math.random().toString(36).slice(2, 9)}`,
      title: text.trim(),
      description: text.trim(),
      status: 'planned'
    }
    onUpdateSprintGoals(sprint.id, [...sprint.goals, newGoal])
    setNewGoalInputs(prev => ({ ...prev, [sprint.id]: '' }))
  }

  function getWorkloadBadge(totalPoints: number, ratio: number, isOverload: boolean) {
    if (totalPoints <= 0) {
      return { label: 'FREE', tone: 'muted', Icon: Zap }
    }
    if (isOverload || ratio > 1) {
      return { label: 'OVERWORKED', tone: 'destructive', Icon: Frown }
    }
    if (ratio >= 0.8) {
      return { label: 'NORMAL', tone: 'warning', Icon: Meh }
    }
    return { label: 'HAPPY', tone: 'good', Icon: Smile }
  }

  if (!activeSquad) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
        No active squad selected. Select a squad in the sidebar or click ADD to create one.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }} data-testid="squad-cockpit-view">

      {/* Squad Page Header — Sanctum-style hero-panel */}
      <section className="hero-panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Squad</div>
            <div className="workspace-header-title-row">
              {isRenamingSquad ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    value={renameSquadValue}
                    onChange={e => setRenameSquadValue(e.target.value)}
                    onBlur={handleSaveRenameSquad}
                    style={{
                      background: 'var(--cp-bg-3)',
                      border: '1px solid var(--cp-cyan)',
                      color: 'var(--foreground)',
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '18px',
                      padding: '4px 8px',
                      outline: 'none',
                      width: '200px'
                    }}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveRenameSquad()
                      else if (e.key === 'Escape') setIsRenamingSquad(false)
                    }}
                  />
                  <span style={{ fontSize: '9px', color: 'var(--cp-green)', fontFamily: "'Share Tech Mono', monospace" }}>
                    AUTO-SAVING
                  </span>
                  <button
                    onMouseDown={e => {
                      e.preventDefault()
                      setIsRenamingSquad(false)
                    }}
                    style={inlineButtonStyle('var(--muted-foreground)', 'var(--cp-bg-3)')}
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <h1
                  className="page-title"
                  style={{ color: 'var(--section-label)' }}
                  onClick={handleStartRenameSquad}
                  title="Click to rename squad"
                >
                  {activeSquad.name}
                </h1>
              )}
              <div className="workspace-header-meta">
                <span className={`workspace-header-pill workspace-header-pill-${squadCapacityStats.isOverload ? 'critical' : 'active'}`}>
                  {squadCapacityStats.isOverload ? 'overload' : 'active'}
                </span>
                <span className="workspace-header-pill workspace-header-pill-medium">
                  sprint cadence
                </span>
              </div>
            </div>
            <p className="hero-copy">
              {activeSquad.developers.length} developers · {squadCapacityStats.assigned} SP assigned · {squadCapacityStats.totalEffective.toFixed(0)} SP effective cap · {squadCapacityStats.totalRaw} SP raw capacity
            </p>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              onClick={handleStartRenameSquad}
              title="Rename squad"
              style={{
                background: 'none',
                border: '1px solid var(--cp-border)',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                fontSize: '10px',
                fontFamily: "'Share Tech Mono', monospace",
                padding: '4px 8px',
                opacity: 0.7
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '1')}
              onMouseOut={e => (e.currentTarget.style.opacity = '0.7')}
            >
              [RENAME]
            </button>
          </div>
        </div>
        <div className="fact-strip">
          <span className="fact-pill" data-testid="assigned-workload-val">{squadCapacityStats.assigned} SP assigned</span>
          <span className="fact-pill">{squadCapacityStats.totalEffective.toFixed(0)} SP effective cap</span>
          <span className="fact-pill">{squadCapacityStats.totalRaw} SP raw</span>
          {squadCapacityStats.isOverload && (
            <span className="fact-pill" style={{ borderColor: 'rgba(255,34,68,0.35)', color: '#ff2244' }}>⚠ overloaded</span>
          )}
        </div>
      </section>

      {/* Main Responsive Cockpit Dashboard Layout */}
      <div className="cockpit-grid" style={{ display: 'grid', gap: '16px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Developer Capacity Slot Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Person List ({activeSquad.developers.length})
            </div>
            <button
              type="button"
              onClick={openAddDeveloperModal}
              title="Add person"
              aria-label="Add person"
              style={{
                width: '28px',
                height: '28px',
                display: 'grid',
                placeItems: 'center',
                border: '1px solid var(--cp-border)',
                background: 'rgba(0, 229, 255, 0.08)',
                color: 'var(--cp-cyan)',
                cursor: 'pointer'
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {devLoadStats.map(({ dev, assignedTickets, totalPoints, effectiveCapacity, ratio, isOverload, statusColor }) => {
              const badge = getWorkloadBadge(totalPoints, ratio, isOverload)
              const BadgeIcon = badge.Icon

              return (
                <div
                  key={dev.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const ticketId = e.dataTransfer.getData('text/plain')
                    if (ticketId) assignTicketToDeveloper(ticketId, dev.id)
                  }}
                  onClick={() => {
                    setSelectedDeveloperId(dev.id)
                    setSelectedTicketId(null)
                    setSelectedPrdId(null)
                    setRightPanelTab('dev-inspector')
                    setRightPanelOpen(true)
                  }}
                  className={`dev-capability-slot ${isOverload ? 'glowing-alert-red' : ''} ${selectedDeveloperId === dev.id ? 'active' : ''}`}
                  style={{
                    background: 'var(--cp-bg-2)',
                    border: isOverload
                      ? '1px solid #ff2244'
                      : selectedDeveloperId === dev.id
                      ? '1px solid var(--cp-cyan)'
                      : '1px solid var(--cp-border)',
                    padding: '12px',
                    borderRadius: '2px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: isOverload
                      ? '0 0 10px rgba(255, 34, 68, 0.2)'
                      : selectedDeveloperId === dev.id
                      ? 'var(--cp-glow-cyan)'
                      : 'none',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  data-testid={`dev-slot-${dev.id}`}
                >
                  {/* Dev Header Details */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--foreground)' }}>
                        {dev.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span 
                          style={{ 
                            fontSize: '9px', 
                            fontFamily: "'Share Tech Mono', monospace", 
                            background: 'rgba(0, 229, 255, 0.1)', 
                            color: 'var(--cp-cyan)',
                            border: '1px solid var(--cp-border)',
                            padding: '1px 4px'
                          }}
                        >
                          {dev.ranking.toUpperCase()}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '9px',
                            fontFamily: "'Share Tech Mono', monospace",
                            border: '1px solid var(--cp-border)',
                            padding: '1px 5px',
                            color:
                              badge.tone === 'destructive'
                                ? 'var(--cp-magenta)'
                                : badge.tone === 'warning'
                                ? 'var(--cp-yellow)'
                                : badge.tone === 'good'
                                ? 'var(--cp-green)'
                                : 'var(--muted-foreground)',
                            background:
                              badge.tone === 'destructive'
                                ? 'rgba(255, 34, 68, 0.08)'
                                : badge.tone === 'warning'
                                ? 'rgba(255, 230, 0, 0.06)'
                                : badge.tone === 'good'
                                ? 'rgba(0, 255, 136, 0.06)'
                                : 'rgba(255, 255, 255, 0.04)'
                          }}
                          title={`${badge.label} workload`}
                        >
                          <BadgeIcon size={10} />
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px', fontFamily: "'Share Tech Mono', monospace" }}>
                      <SpecialtyTagPills tags={dev.specialty_tags} compact />
                      <span style={{ color: 'var(--cp-yellow)' }}>Raw: {dev.raw_capacity} SP</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace", marginBottom: '3px' }}>
                      <span>Load: {totalPoints} SP</span>
                      <span style={{ 
                        color: statusColor === 'destructive' 
                          ? 'var(--cp-magenta)' 
                          : statusColor === 'perfect' 
                          ? 'var(--cp-green)' 
                          : 'var(--cp-cyan)'
                      }}>
                        Max (80%): {effectiveCapacity.toFixed(0)} SP
                      </span>
                    </div>

                    <div style={{ height: '8px', background: 'var(--cp-bg-3)', position: 'relative', border: '1px solid rgba(0, 229, 255, 0.08)' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${Math.min(ratio * 100, 100)}%`,
                          background: statusColor === 'destructive'
                            ? 'linear-gradient(90deg, #ff8800, #ff2244)'
                            : statusColor === 'perfect'
                            ? '#00ff88'
                            : 'var(--cp-cyan)',
                          boxShadow: statusColor === 'destructive'
                            ? '0 0 6px rgba(255, 34, 68, 0.6)'
                            : statusColor === 'perfect'
                            ? '0 0 6px rgba(0, 255, 136, 0.6)'
                            : '0 0 6px rgba(0, 229, 255, 0.6)',
                          transition: 'width 0.3s ease-in-out'
                        }}
                      />
                    </div>
                  </div>

                  {/* Assigned Tickets inside Dev Slot */}
                  <div style={{ flex: 1, minHeight: '60px', background: 'rgba(0,0,0,0.15)', padding: '6px', border: '1px dashed var(--cp-border)' }}>
                    {assignedTickets.length === 0 ? (
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', opacity: 0.4, textAlign: 'center', paddingTop: '16px', fontStyle: 'italic' }}>
                        Drop tickets here
                      </div>
                    ) : (
                      assignedTickets.map(t => (
                        <div 
                          key={t.ticket_id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', t.ticket_id)}
                          style={{
                            background: 'var(--cp-bg-3)',
                            border: '1px solid var(--cp-border)',
                            padding: '4px 6px',
                            marginBottom: '4px',
                            fontSize: '11px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'grab'
                          }}
                          data-testid={`assigned-ticket-${t.ticket_id}`}
                        >
                          <span style={{ color: 'var(--cp-cyan)', fontWeight: 'bold' }}>{t.ticket_key}</span>
                          <span style={{ color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, margin: '0 6px' }}>{t.title.replace(/\[SP-\d+\]\s*/i, '')}</span>
                          <span style={{ color: 'var(--cp-green)', fontWeight: 'bold' }}>{t.story_points}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Sprint Operations Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Card 1: Active Sprint Console */}
          <div style={panelCardStyle}>
            <div style={panelHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={14} style={{ color: 'var(--cp-cyan)' }} />
                <span>ACTIVE SPRINT</span>
              </div>
              <div style={{
                fontSize: '9px',
                background: activeSprint ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255,255,255,0.05)',
                color: activeSprint ? 'var(--cp-green)' : 'var(--muted-foreground)',
                border: '1px solid var(--cp-border)',
                padding: '2px 6px',
                fontWeight: 'bold',
                fontFamily: "'Share Tech Mono', monospace"
              }}>
                {activeSprint ? 'LIVE' : 'NO SPRINT ACTIVE'}
              </div>
            </div>

            <div style={panelBodyStyle}>
              {activeSprint ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Sprint Name & Dates Controls */}
                  <div style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', padding: '10px' }}>
                    {isEditingActiveSprint ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'grid', gap: '2px' }}>
                          <span style={fieldLabelStyle}>Sprint Name</span>
                          <input 
                            value={editSprintName} 
                            onChange={e => setEditSprintName(e.target.value)} 
                            onBlur={() => handleAutoSaveActiveSprint(editSprintName, editSprintStart, editSprintWorkingDays)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveActiveSprint()
                            }}
                            style={inputStyle}
                          />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
                          <label style={{ display: 'grid', gap: '2px' }}>
                            <span style={fieldLabelStyle}>Start Date (Calendar)</span>
                            <input 
                              type="date" 
                              value={editSprintStart} 
                              onChange={e => {
                                setEditSprintStart(e.target.value)
                                handleAutoSaveActiveSprint(editSprintName, e.target.value, editSprintWorkingDays)
                              }}
                              onClick={e => {
                                try { e.currentTarget.showPicker() } catch(err) {}
                              }}
                              style={inputStyle}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: '2px' }}>
                            <span style={fieldLabelStyle}>Working Days</span>
                            <input 
                              type="number"
                              min="1"
                              value={editSprintWorkingDays} 
                              onChange={e => {
                                const val = parseInt(e.target.value) || 1
                                setEditSprintWorkingDays(val)
                                handleAutoSaveActiveSprint(editSprintName, editSprintStart, val)
                              }}
                              onBlur={() => handleAutoSaveActiveSprint(editSprintName, editSprintStart, editSprintWorkingDays)}
                              style={inputStyle}
                            />
                          </label>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", marginTop: '4px' }}>
                          Auto End Date: {editSprintCalculatedEnd}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                          <span style={{ fontSize: '9px', color: 'var(--cp-green)', fontFamily: "'Share Tech Mono', monospace" }}>
                            // AUTO-SAVE ACTIVE
                          </span>
                          <button onClick={() => setIsEditingActiveSprint(false)} style={secondaryButtonStyle}>
                            Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--foreground)' }}>
                            {activeSprint.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", marginTop: '2px' }}>
                            Start: {activeSprint.start_date} · End: {activeSprint.end_date}
                          </div>
                        </div>
                        <button onClick={handleStartEditActiveSprint} style={secondarySmallButtonStyle}>
                          <Edit size={10} /> Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Active Goals Checklist */}
                  <div>
                    <div style={sectionSubheadStyle}>Sprint Goal Checklist</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      {activeSprint.goals.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontStyle: 'italic', padding: '4px 0' }}>
                          No goals configured for this sprint.
                        </div>
                      ) : (
                        activeSprint.goals.map(goal => (
                          <div 
                            key={goal.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              gap: '8px', 
                              background: 'var(--cp-bg-3)',
                              border: '1px solid var(--cp-border)',
                              padding: '6px 8px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <input 
                                type="checkbox"
                                checked={goal.status === 'done'}
                                onChange={() => handleToggleGoalStatus(activeSprint, goal.id, goal.status)}
                                style={{ cursor: 'pointer', accentColor: 'var(--cp-green)' }}
                              />
                              <span style={{ 
                                fontSize: '12px', 
                                color: goal.status === 'done' ? 'var(--muted-foreground)' : 'var(--foreground)',
                                textDecoration: goal.status === 'done' ? 'line-through' : 'none'
                              }}>
                                {goal.title}
                              </span>
                            </div>

                            {/* Dropdown status selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <select
                                value={goal.status}
                                onChange={(e) => handleUpdateGoalStatusVal(activeSprint, goal.id, e.target.value as SprintGoal['status'])}
                                style={{
                                  background: 'var(--cp-bg-0)',
                                  border: '1px solid var(--cp-border)',
                                  color: goal.status === 'done'
                                    ? 'var(--cp-green)'
                                    : goal.status === 'blocked'
                                    ? 'var(--cp-magenta)'
                                    : 'var(--cp-yellow)',
                                  fontSize: '10px',
                                  fontFamily: "'Share Tech Mono', monospace",
                                  outline: 'none',
                                  padding: '2px'
                                }}
                              >
                                <option value="planned">Planned</option>
                                <option value="active">Active</option>
                                <option value="blocked">Blocked</option>
                                <option value="done">Done</option>
                              </select>

                              <button 
                                onClick={() => handleDeleteGoal(activeSprint, goal.id)}
                                title="Remove goal"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--cp-magenta)',
                                  cursor: 'pointer',
                                  padding: '2px'
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Goal Input */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <input 
                        placeholder="Add sprint goal..."
                        value={newGoalInputs[activeSprint.id] || ''}
                        onChange={e => {
                          const val = e.target.value
                          setNewGoalInputs(prev => ({ ...prev, [activeSprint.id]: val }))
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddGoal(activeSprint)
                        }}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button onClick={() => handleAddGoal(activeSprint)} style={primaryButtonStyle}>
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button 
                      onClick={() => onCompleteSprint(activeSprint.id)} 
                      style={{
                        ...primaryButtonStyle,
                        background: 'rgba(0, 255, 136, 0.08)',
                        color: 'var(--cp-green)',
                        border: '1px solid var(--cp-green)',
                        flex: 1
                      }}
                    >
                      <CheckCircle2 size={14} />
                      Complete & Archive Sprint
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 8px', border: '1px dashed var(--cp-border)', color: 'var(--muted-foreground)', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace" }}>
                  <AlertTriangle size={16} style={{ color: 'var(--cp-yellow)', display: 'block', margin: '0 auto 6px' }} />
                  NO CURRENT ACTIVE SPRINT
                  <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>
                    Activate a sprint from the queue below or create a new plan.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card: Attached PRDs */}
          <div style={panelCardStyle}>
            <div style={panelHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={14} style={{ color: 'var(--cp-cyan)' }} />
                <span>ATTACHED PRDS</span>
              </div>
              <div style={{
                fontSize: '9px',
                background: 'rgba(0, 229, 255, 0.08)',
                color: 'var(--cp-cyan)',
                border: '1px solid var(--cp-border)',
                padding: '2px 6px',
                fontWeight: 'bold',
                fontFamily: "'Share Tech Mono', monospace"
              }}>
                {squadPrds.length} LINKED
              </div>
            </div>
            <div style={panelBodyStyle}>
              {squadPrds.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontStyle: 'italic', padding: '4px 0', fontFamily: "'Share Tech Mono', monospace" }}>
                  No PRDs linked to this squad. Link a PRD from the PRD Document Inspector.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {squadPrds.map(prd => (
                    <div 
                      key={prd.id}
                      onClick={() => onSelectPrd && onSelectPrd(prd.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--cp-bg-3)',
                        border: '1px solid var(--cp-border)',
                        padding: '8px 10px',
                        cursor: 'pointer',
                        transition: 'border 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--cp-cyan)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--cp-border)'}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--foreground)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '180px', textAlign: 'left' }}>
                          {prd.title}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', textAlign: 'left' }}>
                          Status: <span style={{ color: prd.status === 'synced' ? 'var(--cp-green)' : prd.status === 'ready' ? 'var(--cp-cyan)' : 'var(--foreground)' }}>{prd.status.toUpperCase()}</span>
                        </span>
                      </div>
                      <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)' }}>VIEW →</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Sprint Planner Console */}
          <div style={panelCardStyle}>
            <div 
              style={{ ...panelHeaderStyle, cursor: 'pointer' }}
              onClick={() => setIsSprintPanelOpen(!isSprintPanelOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={14} style={{ color: 'var(--cp-cyan)' }} />
                <span>FUTURE SPRINTS & PLANNING</span>
              </div>
              <div>
                {isSprintPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>

            {isSprintPanelOpen && (
              <div style={panelBodyStyle}>
                
                {/* Section A: Create Upcoming Sprint Form */}
                <div style={{ borderBottom: '1px solid var(--cp-border)', paddingBottom: '14px', marginBottom: '14px' }}>
                  <div style={sectionSubheadStyle}>Schedule New Sprint</div>
                  <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                    <label style={{ display: 'grid', gap: '2px' }}>
                      <span style={fieldLabelStyle}>Sprint Name</span>
                      <input 
                        value={newSprintName} 
                        onChange={e => setNewSprintName(e.target.value)} 
                        placeholder="e.g. Sprint 16"
                        style={inputStyle}
                      />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
                      <label style={{ display: 'grid', gap: '2px' }}>
                        <span style={fieldLabelStyle}>Start Date (Calendar)</span>
                        <input 
                          type="date" 
                          value={newSprintStart} 
                          onChange={e => setNewSprintStart(e.target.value)} 
                          onClick={e => {
                            try { e.currentTarget.showPicker() } catch(err) {}
                          }}
                          style={inputStyle}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: '2px' }}>
                        <span style={fieldLabelStyle}>Working Days</span>
                        <input 
                          type="number" 
                          min="1"
                          value={newSprintWorkingDays} 
                          onChange={e => setNewSprintWorkingDays(parseInt(e.target.value) || 1)} 
                          style={inputStyle}
                        />
                      </label>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
                      Calculated End Date: {newSprintCalculatedEnd}
                    </div>
                    <label style={{ display: 'grid', gap: '2px' }}>
                      <span style={fieldLabelStyle}>Primary Goal</span>
                      <input 
                        value={newSprintGoal} 
                        onChange={e => setNewSprintGoal(e.target.value)} 
                        placeholder="Primary mission detail..."
                        style={inputStyle}
                      />
                    </label>
                    <button 
                      onClick={() => {
                        if (!newSprintName.trim()) return
                        onCreateSprint({
                          name: newSprintName.trim(),
                          start_date: newSprintStart,
                          end_date: newSprintCalculatedEnd,
                          goal: newSprintGoal.trim()
                        })
                        setNewSprintName('')
                        setNewSprintGoal('Deliver planned scope')
                      }}
                      style={{ ...primaryButtonStyle, marginTop: '4px' }}
                    >
                      <Plus size={14} /> Schedule Sprint Plan
                    </button>
                  </div>
                </div>

                {/* Section B: Sprint Queue List */}
                <div>
                  <div style={sectionSubheadStyle}>Sprint Queue ({upcomingSprints.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {upcomingSprints.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '12px', background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                        No upcoming sprints planned.
                      </div>
                    ) : (
                      upcomingSprints.map(plan => {
                        const isExpanded = expandedSprintId === plan.id
                        const planWorkingDays = calculateWorkingDaysBetween(plan.start_date, plan.end_date, squadWorkingDays)
                        
                        return (
                          <div 
                            key={plan.id}
                            style={{
                              background: 'var(--cp-bg-3)',
                              border: isExpanded ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                              padding: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--foreground)' }}>
                                  {plan.name}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                                  {plan.start_date} → {plan.end_date} ({planWorkingDays} work days)
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--cp-yellow)', fontFamily: "'Share Tech Mono', monospace", marginTop: '2px' }}>
                                  {plan.goals.length} Goals scheduled
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  onClick={() => setExpandedSprintId(isExpanded ? null : plan.id)}
                                  style={secondarySmallButtonStyle}
                                >
                                  {isExpanded ? 'Collapse' : 'Manage'}
                                </button>
                                <button 
                                  onClick={() => onSetCurrentSprint(plan.id)}
                                  style={{
                                    ...secondarySmallButtonStyle,
                                    background: 'rgba(0, 229, 255, 0.1)',
                                    color: 'var(--cp-cyan)',
                                    borderColor: 'var(--cp-cyan)'
                                  }}
                                >
                                  <Play size={10} /> Activate
                                </button>
                                <button 
                                  onClick={() => onDeleteSprint(plan.id)}
                                  title="Delete planned sprint"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--cp-magenta)',
                                    cursor: 'pointer',
                                    padding: '4px'
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Collapsible Goal Checklist & Date Editor for Planned Sprint */}
                            {isExpanded && (
                              <div style={{ borderTop: '1px solid var(--cp-border)', paddingTop: '8px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                
                                {/* Inline Date Editor for Planned Sprint */}
                                <div style={{ display: 'grid', gap: '6px', background: 'var(--cp-bg-0)', padding: '8px', border: '1px solid var(--cp-border)' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>Edit Sprint Properties</span>
                                  <label style={{ display: 'grid', gap: '2px' }}>
                                    <span style={fieldLabelStyle}>Sprint Name</span>
                                    <input 
                                      value={plan.name} 
                                      onChange={e => onUpdateSprint(plan.id, { name: e.target.value })} 
                                      style={smallInputStyle}
                                    />
                                  </label>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <label style={{ display: 'grid', gap: '2px' }}>
                                      <span style={fieldLabelStyle}>Start Date</span>
                                      <input 
                                        type="date" 
                                        value={plan.start_date} 
                                        onChange={e => {
                                          const newStart = e.target.value
                                          const days = calculateWorkingDaysBetween(newStart, plan.end_date, squadWorkingDays) || 10
                                          const newEnd = getEndDateFromWorkingDays(newStart, days, squadWorkingDays)
                                          onUpdateSprint(plan.id, { start_date: newStart, end_date: newEnd })
                                        }} 
                                        onClick={e => {
                                          try { e.currentTarget.showPicker() } catch(err) {}
                                        }}
                                        style={smallInputStyle}
                                      />
                                    </label>
                                    <label style={{ display: 'grid', gap: '2px' }}>
                                      <span style={fieldLabelStyle}>Working Days</span>
                                      <input 
                                        type="number" 
                                        min="1"
                                        value={planWorkingDays} 
                                        onChange={e => {
                                          const days = parseInt(e.target.value) || 1
                                          const newEnd = getEndDateFromWorkingDays(plan.start_date, days, squadWorkingDays)
                                          onUpdateSprint(plan.id, { end_date: newEnd })
                                        }} 
                                        style={smallInputStyle}
                                      />
                                    </label>
                                  </div>
                                  <div style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
                                    Auto End Date: {plan.end_date}
                                  </div>
                                </div>

                                {/* Goals checklist */}
                                <div>
                                  <div style={{ ...fieldLabelStyle, marginBottom: '6px' }}>Sprint Goals ({plan.goals.length})</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {plan.goals.length === 0 ? (
                                      <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No goals scheduled.</span>
                                    ) : (
                                      plan.goals.map(g => (
                                        <div 
                                          key={g.id}
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: 'var(--cp-bg-0)',
                                            border: '1px solid var(--cp-border)',
                                            padding: '4px 6px',
                                            fontSize: '11px'
                                          }}
                                        >
                                          <span>{g.title}</span>
                                          <button 
                                            onClick={() => handleDeleteGoal(plan, g.id)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              color: 'var(--cp-magenta)',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            <X size={10} />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                    <input 
                                      placeholder="Add goal detail..."
                                      value={newGoalInputs[plan.id] || ''}
                                      onChange={e => {
                                        const val = e.target.value
                                        setNewGoalInputs(prev => ({ ...prev, [plan.id]: val }))
                                      }}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleAddGoal(plan)
                                      }}
                                      style={smallInputStyle}
                                    />
                                    <button onClick={() => handleAddGoal(plan)} style={secondarySmallButtonStyle}>
                                      + Add
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Section C: Complete Sprints Archive */}
                {completedSprints.length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px dashed var(--cp-border)', paddingTop: '12px' }}>
                    <div style={sectionSubheadStyle}>Completed Sprints ({completedSprints.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      {completedSprints.map(sprint => (
                        <div 
                          key={sprint.id}
                          style={{
                            background: 'var(--cp-bg-3)',
                            opacity: 0.7,
                            border: '1px solid var(--cp-border)',
                            padding: '6px 10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--foreground)' }}>
                              {sprint.name}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", marginLeft: '8px' }}>
                              Ended: {sprint.end_date}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '9px',
                            color: 'var(--cp-green)',
                            background: 'rgba(0, 255, 136, 0.04)',
                            border: '1px solid rgba(0, 255, 136, 0.15)',
                            padding: '1px 4px',
                            fontFamily: "'Share Tech Mono', monospace"
                          }}>
                            ARCHIVED
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}

// Styling Constants
const panelCardStyle: React.CSSProperties = {
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-2)',
  borderRadius: '2px',
  display: 'flex',
  flexDirection: 'column'
}

const panelHeaderStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-3)',
  padding: '8px 12px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '11px',
  fontFamily: "'Share Tech Mono', monospace",
  fontWeight: 'bold',
  color: 'var(--cp-cyan)',
  textTransform: 'uppercase'
}

const panelBodyStyle: React.CSSProperties = {
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
}

const sectionSubheadStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--cp-cyan)',
  fontFamily: "'Share Tech Mono', monospace",
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--muted-foreground)',
  fontFamily: "'Share Tech Mono', monospace', sans-serif"
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-3)',
  color: 'var(--foreground)',
  padding: '6px 8px',
  fontSize: '12px',
  outline: 'none'
}

const smallInputStyle: React.CSSProperties = {
  flex: 1,
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-0)',
  color: 'var(--foreground)',
  padding: '4px 6px',
  fontSize: '11px',
  outline: 'none'
}

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: '1px solid var(--cp-border)',
  background: 'rgba(0, 229, 255, 0.08)',
  color: 'var(--cp-cyan)',
  padding: '6px 12px',
  fontSize: '11px',
  fontFamily: "'Share Tech Mono', monospace",
  textTransform: 'uppercase',
  cursor: 'pointer'
}

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-3)',
  color: 'var(--foreground)',
  padding: '6px 12px',
  fontSize: '11px',
  fontFamily: "'Share Tech Mono', monospace",
  cursor: 'pointer'
}

const secondarySmallButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-0)',
  color: 'var(--muted-foreground)',
  padding: '3px 8px',
  fontSize: '10px',
  fontFamily: "'Share Tech Mono', monospace",
  cursor: 'pointer'
}

const inlineButtonStyle = (color: string, bg: string): React.CSSProperties => ({
  background: bg,
  border: `1px solid ${color}`,
  color: color,
  fontSize: '11px',
  fontFamily: "'Share Tech Mono', monospace",
  padding: '4px 8px',
  cursor: 'pointer'
})

// Helper Functions
function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function plusDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

// Calculate the End Date based on start date, working days count, and the active squad's working days
function getEndDateFromWorkingDays(startDateStr: string, workingDaysCount: number, workingDaysList: string[]): string {
  if (!startDateStr || !workingDaysCount || workingDaysCount <= 0) return ''
  const date = new Date(startDateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return ''
  
  const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const lowerCaseWorkingDays = workingDaysList.map(d => d.toLowerCase())
  
  let current = new Date(date)
  let count = 0
  
  while (count < workingDaysCount) {
    const dayName = DAY_NAMES[current.getDay()]
    const isWorkingDay = lowerCaseWorkingDays.includes(dayName)
    
    if (isWorkingDay) {
      if (count === workingDaysCount - 1) {
        break
      }
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  
  return current.toISOString().slice(0, 10)
}

// Calculate number of working days between two dates based on the active squad's working days
function calculateWorkingDaysBetween(startStr: string, endStr: string, workingDaysList: string[]): number {
  if (!startStr || !endStr) return 10
  const start = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr + 'T00:00:00')
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 10
  if (start > end) return 0
  
  const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const lowerCaseWorkingDays = workingDaysList.map(d => d.toLowerCase())
  
  let current = new Date(start)
  let count = 0
  
  while (current <= end) {
    const dayName = DAY_NAMES[current.getDay()]
    if (lowerCaseWorkingDays.includes(dayName)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  
  return count
}
