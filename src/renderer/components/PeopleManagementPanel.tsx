import { useMemo } from 'react'
import { Pencil, Plus, Users, Briefcase, Gauge, Sparkles } from 'lucide-react'
import type { Developer, FeatureRequest, JiraTicket, ProjectEntity, Squad, SprintPlan } from '../services/localState'
import { SpecialtyTagPills } from './DeveloperSpecialties'

type Props = {
  squads: Squad[]
  tickets: JiraTicket[]
  projects: ProjectEntity[]
  features: FeatureRequest[]
  sprintPlans: SprintPlan[]
  onAddPerson: () => void
  onEditPerson: (developer: Developer) => void
}

export function PeopleManagementPanel({ squads, tickets, projects, features, sprintPlans, onAddPerson, onEditPerson }: Props) {
  const people = useMemo(() => squads.flatMap((squad) => squad.developers.map((developer) => ({ developer, squad }))), [squads])
  const totals = useMemo(() => people.reduce((acc, item) => {
    const assigned = tickets.filter((ticket) => ticket.assignee === item.developer.id).reduce((sum, ticket) => sum + ticket.story_points, 0)
    acc.capacity += item.developer.raw_capacity
    acc.assigned += assigned
    return acc
  }, { capacity: 0, assigned: 0 }), [people, tickets])

  return <div className="forge-management-page" data-testid="people-page">
    <header className="hero-panel">
      <div className="panel-head">
        <div><div className="eyebrow">People</div><h1 className="page-title">People & capability</h1><p className="hero-copy">Create and update developers, see their capacity, workload, squad, delivery scope, and strengths.</p></div>
        <button type="button" onClick={onAddPerson} style={primaryButtonStyle}><Plus size={14} /> Add person</button>
      </div>
      <div className="fact-strip"><span className="fact-pill"><Users size={11} /> {people.length} people</span><span className="fact-pill"><Gauge size={11} /> {totals.capacity} SP raw capacity</span><span className="fact-pill"><Briefcase size={11} /> {totals.assigned} SP assigned</span><span className="fact-pill">{squads.length} squads</span></div>
    </header>
    <div className="management-grid">
      {people.map(({ developer, squad }) => {
        const assigned = tickets.filter((ticket) => ticket.assignee === developer.id)
        const points = assigned.reduce((sum, ticket) => sum + ticket.story_points, 0)
        const effective = developer.raw_capacity * 0.8
        const ratio = effective ? points / effective : 0
        const projectIds = new Set(assigned.map((ticket) => ticket.project_id).filter(Boolean))
        const featureCount = features.filter((feature) => projectIds.has(feature.project_id)).length
        const sprintNames = Array.from(new Set(assigned.map((ticket) => ticket.sprint_id ? sprintPlans.find((sprint) => sprint.id === ticket.sprint_id)?.name : undefined).filter(Boolean)))
        const projectNames = Array.from(projectIds).map((id) => projects.find((project) => project.id === id)?.name).filter(Boolean)
        return <article className="management-card" key={developer.id}>
          <div className="card-title-row"><div><div className="eyebrow">{squad.name}</div><h2>{developer.name}</h2></div><button type="button" onClick={() => onEditPerson(developer)} style={iconButtonStyle} title={`Edit ${developer.name}`} aria-label={`Edit ${developer.name}`}><Pencil size={13} /></button></div>
          <div className="tag-row"><span className="status-chip">{developer.ranking}</span><span className={ratio > 1 ? 'status-chip danger' : ratio >= .8 ? 'status-chip warning' : 'status-chip good'}>{points} / {effective.toFixed(0)} SP</span><span className="status-chip">{developer.region} · {developer.timezone}</span></div>
          <div className="capacity-bar"><span style={{ width: `${Math.min(ratio * 100, 100)}%` }} /></div>
          <div className="card-stats"><Stat label="Working on" value={`${assigned.length} tickets · ${sprintNames.join(', ') || 'backlog'}`} /><Stat label="Projects" value={projectNames.join(', ') || 'No project linked'} /><Stat label="Features" value={`${featureCount} involved`} /></div>
          <div className="strengths"><div className="eyebrow"><Sparkles size={11} /> Strengths</div><SpecialtyTagPills tags={developer.specialty_tags} compact /></div>
        </article>
      })}
      {people.length === 0 && <Empty text="No people yet. Add the first developer to start building your capacity model." />}
    </div>
  </div>
}
function Stat({ label, value }: { label: string; value: string }) { return <div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div> }
function Empty({ text }: { text: string }) { return <div className="empty-management">{text}</div> }
const primaryButtonStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid var(--cp-cyan)', background: 'rgba(0,229,255,.1)', color: 'var(--cp-cyan)', padding: '8px 10px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' as const, fontSize: '10px' }
const iconButtonStyle = { display: 'grid', placeItems: 'center', width: '28px', height: '28px', background: 'var(--cp-bg-3)', color: 'var(--cp-cyan)', border: '1px solid var(--cp-border)', cursor: 'pointer' }
