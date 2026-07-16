import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Folder,
  FolderOpen,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit3,
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Search,
  Tag,
  Layers,
  BookOpen,
  GitBranch,
  Lock,
  PenLine,
  RefreshCw,
  Target,
  Flag,
  X,
  Save,
  Eye,
  Settings,
  AlertCircle,
  ExternalLink
} from 'lucide-react'
import { createStructuredPrd, generateOneLineEpic, decomposeEpicIntoTickets, type GeneratedPlanTicket } from '../services/planningWorkflow'
import {
  saveProjectEntity,
  getFeatureRequestsByProject,
  getFeatureRequests,
  saveFeatureRequest,
  deleteFeatureRequest,
  getLocalPRDs,
  saveLocalPRD,
  type ProjectEntity,
  type FeatureRequest,
  type PRDDocument,
  type JiraTicket,
  type Squad
} from '../services/localState'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PMSelection =
  | { kind: 'none' }
  | { kind: 'project'; id: string }
  | { kind: 'feature'; id: string; projectId: string }
  | { kind: 'prd'; id: string; projectId?: string }

export type PMDrawerMode =
  | 'closed'
  | 'view-project'
  | 'edit-project'
  | 'edit-feature'
  | 'edit-prd'
  | 'new-project'
  | 'new-feature'
  | 'new-prd'
  | 'athena'

export interface PMPanelProps {
  projects: ProjectEntity[]
  features: FeatureRequest[]
  prds: PRDDocument[]
  tickets: JiraTicket[]
  squads: Squad[]
  sprintPlans?: Array<{ id: string; name: string; status: string; squad_id: string }>
  activeSquadId: string
  onSaveProject: (project: ProjectEntity) => void
  onDeleteProject?: (projectId: string) => void
  onSaveFeature: (feature: FeatureRequest) => void
  onDeleteFeature: (featureId: string) => void
  onSavePRD: (prd: PRDDocument) => void
  onDeletePRD: (prdId: string) => void
  onConvertFeatureToPRD: (feature: FeatureRequest) => PRDDocument
  onOpenAthena: (contextKey: string, contextKind: string, contextData: Record<string, unknown>) => void
  onNewProject?: () => void
  onSelectionChange?: (selection: PMSelection, project?: ProjectEntity) => void
  onRequestEditProject?: (project: ProjectEntity) => void
  onRequestDeleteProject?: (project: ProjectEntity) => void
  onProjectDrawerChange?: (open: boolean) => void
  projectActionSignal?: { type: 'edit' | 'delete' | 'athena' | 'create-feature'; projectId: string; nonce: number } | null
  onSelectTicket?: (ticketId: string) => void
  selectedPrdId?: string | null
  onSelectPrd?: (prdId: string | null) => void
  onGeneratePlan?: (prd: PRDDocument, tickets: GeneratedPlanTicket[], sprintId?: string) => void | Promise<void>
  openInitialProject?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const healthColors: Record<string, { dot: string; glow: string }> = {
  green:  { dot: '#00ff88', glow: 'rgba(0,255,136,0.35)' },
  yellow: { dot: '#ffe600', glow: 'rgba(255,230,0,0.35)' },
  red:    { dot: '#ff4444', glow: 'rgba(255,68,68,0.35)' }
}

function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; border: string }> = {
    draft:   { bg: 'rgba(255,230,0,0.07)',   color: '#ffe600',  border: 'rgba(255,230,0,0.2)' },
    final:   { bg: 'rgba(0,255,136,0.07)',   color: '#00ff88',  border: 'rgba(0,255,136,0.2)' },
    ready:   { bg: 'rgba(0,229,255,0.07)',   color: '#00e5ff',  border: 'rgba(0,229,255,0.2)' },
    synced:  { bg: 'rgba(0,255,136,0.1)',    color: '#00ff88',  border: 'rgba(0,255,136,0.3)' },
    green:   { bg: 'rgba(0,255,136,0.07)',   color: '#00ff88',  border: 'rgba(0,255,136,0.2)' },
    yellow:  { bg: 'rgba(255,230,0,0.07)',   color: '#ffe600',  border: 'rgba(255,230,0,0.2)' },
    red:     { bg: 'rgba(255,68,68,0.07)',   color: '#ff5555',  border: 'rgba(255,68,68,0.2)' }
  }
  const c = cfg[status] || cfg.draft
  return (
    <span style={{
      fontSize: '8px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700,
      letterSpacing: '0.1em', padding: '2px 5px',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap'
    }}>
      {(status === 'final' || status === 'synced') && <Lock size={7} />}
      {status.toUpperCase()}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)',
      letterSpacing: '0.1em', opacity: 0.5, marginBottom: '6px', textTransform: 'uppercase'
    }}>
      {children}
    </div>
  )
}

function InfoBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: '12px' }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{
        fontSize: mono ? '11px' : '12px',
        fontFamily: mono ? 'monospace' : 'inherit',
        color: 'var(--foreground)', lineHeight: '1.6',
        background: 'var(--cp-bg-3)', padding: '10px',
        border: '1px solid var(--cp-border)',
        whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto'
      }}>
        {value}
      </div>
    </div>
  )
}

function getFeaturePrdIds(feature: FeatureRequest) {
  const ids = Array.isArray(feature.prd_ids) && feature.prd_ids.length > 0
    ? feature.prd_ids.filter(Boolean)
    : feature.prd_id
    ? [feature.prd_id]
    : []
  return ids
}

// ─── Left Project Tree ───────────────────────────────────────────────────────

function ProjectTree({
  projects, features, squads, selection, onSelect, onNewProject
}: {
  projects: ProjectEntity[]
  features: FeatureRequest[]
  squads: Squad[]
  selection: PMSelection
  onSelect: (sel: PMSelection) => void
  onNewProject?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')

  function isSelected(kind: PMSelection['kind'], id: string) {
    return selection.kind === kind && (selection as any).id === id
  }

  const visibleProjects = projects.filter((project) => {
    const haystack = [
      project.name,
      project.description,
      project.goals,
      project.functionalities
    ].join(' ').toLowerCase()
    return haystack.includes(searchText.toLowerCase())
  })

  return (
    <div style={{
      width: isOpen ? '280px' : '44px',
      minWidth: isOpen ? '280px' : '44px',
      flexShrink: 0,
      borderRight: '1px solid var(--cp-border)',
      background: 'linear-gradient(180deg, rgba(0,229,255,0.03), transparent 28%), var(--cp-bg-1)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 180ms ease, min-width 180ms ease, max-width 180ms ease'
    }}>
      {/* Header */}
      <div style={{
        height: '30px',
        flexShrink: 0,
        padding: isOpen ? '0 8px' : '0',
        borderBottom: '1px solid var(--cp-border)',
        color: 'var(--cp-cyan)',
        fontFamily: "'Share Tech Mono', monospace",
        display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'space-between' : 'center',
        gap: '6px'
      }}>
        {isOpen && <span style={{ fontSize: '11px', opacity: 0.58, letterSpacing: '0.16em', textTransform: 'uppercase' }}>PROJECT TREE</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isOpen && (
            <button
              type="button"
              onClick={() => onNewProject?.()}
              title="New project"
              aria-label="New project"
              style={{
                width: '22px',
                height: '22px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 0,
                color: 'var(--cp-cyan)',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <Plus size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            title={isOpen ? 'Collapse projects list' : 'Expand projects list'}
            aria-label={isOpen ? 'Collapse projects list' : 'Expand projects list'}
              style={{
                width: '22px',
                height: '22px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
                border: 0,
                color: 'var(--cp-cyan)',
                cursor: 'pointer',
                padding: 0
              }}
            >
            {isOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>
      </div>

      {/* Tree list */}
      {isOpen && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '8px', borderBottom: '1px solid var(--cp-border)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={11} style={{ position: 'absolute', left: '8px', color: 'var(--cp-cyan)', opacity: 0.5 }} />
            <input
              type="text"
            placeholder="search projects..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
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
        {visibleProjects.length === 0 && (
          <div style={{
            padding: '20px 12px', textAlign: 'center',
            fontSize: '11px', color: 'var(--muted-foreground)', fontStyle: 'italic'
          }}>
            No projects.<br />Use the rail → to add one.
          </div>
        )}

        <div style={{ padding: '8px', display: 'grid', gap: '6px' }}>
        {visibleProjects.map(project => {
          const projectFeatures = features.filter(f => f.project_id === project.id)
          const selProject = isSelected('project', project.id)
          const hc = healthColors[project.health_status] || healthColors.green

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                onSelect({ kind: 'project', id: project.id })
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                background: selProject ? 'rgba(0, 229, 255, 0.08)' : 'var(--cp-bg-2)',
                border: selProject ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                padding: '8px',
                cursor: 'pointer',
                display: 'grid',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: hc.dot, boxShadow: `0 0 5px ${hc.glow}`,
                    flexShrink: 0, display: 'block'
                  }} />
                  <span style={{
                    color: 'var(--foreground)', fontSize: '12px', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {project.name}
                  </span>
                </div>
                <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--muted-foreground)' }}>
                  {project.squad_id ? squads.find(s => s.id === project.squad_id)?.name || 'Unassigned' : 'Unassigned'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--muted-foreground)' }}>
                <span>{projectFeatures.length} features</span>
                <span style={{ color: project.health_status === 'green' ? 'var(--cp-green)' : project.health_status === 'yellow' ? 'var(--cp-yellow)' : 'var(--cp-magenta)' }}>
                  {project.health_status.toUpperCase()}
                </span>
              </div>
            </button>
          )
        })}
        </div>
        </div>
      )}

      {!isOpen && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontFamily: "'Share Tech Mono', monospace",
            color: 'var(--section-label)',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            letterSpacing: '0.12em',
            opacity: 0.6
          }}>
          PROJECTS
        </div>
      )}
    </div>
  )
}

// ─── Center Overview Panels ───────────────────────────────────────────────────

function EmptyOverview({ onNewProject }: { onNewProject: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px',
      color: 'var(--muted-foreground)', padding: '40px'
    }}>
      <Folder size={40} style={{ opacity: 0.15 }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '14px', marginBottom: '6px', color: 'var(--foreground)', opacity: 0.5 }}>
          No project selected
        </div>
        <div style={{ fontSize: '11px', opacity: 0.4 }}>
          Select a project from the tree to view its overview,<br />
          or create a new one using the action rail →
        </div>
      </div>
    </div>
  )
}

function ProjectOverview({
  project, features, prds, squads, onSelect
}: {
  project: ProjectEntity
  features: FeatureRequest[]
  prds: PRDDocument[]
  squads: Squad[]
  onSelect: (sel: PMSelection) => void
}) {
  const projectFeatures = features.filter(f => f.project_id === project.id)
  const projectPrds = prds.filter(p => p.project_id === project.id)
  const squad = squads.find(s => s.id === project.squad_id)
  const hc = healthColors[project.health_status] || healthColors.green

  const featureDraftCount = projectFeatures.filter(f => f.status === 'draft').length
  const featureFinalCount = projectFeatures.filter(f => f.status === 'final').length

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '1000px' }}>
      <section className="hero-panel" style={{ marginBottom: '2px' }}>
        <div className="panel-head">
        <div>
          <div className="eyebrow">Selected Card</div>
          <div className="workspace-header-title-row">
            <h1 className="page-title">
              {project.name}
              </h1>
              <div className="workspace-header-meta">
                <span className="workspace-header-pill workspace-header-pill-active">
                  {project.health_status}
                </span>
                {squad && (
                  <span className="workspace-header-pill workspace-header-pill-medium">
                    {squad.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="panel-actions">
            <span className="workspace-header-pill workspace-header-pill-open">projects</span>
            <span className="workspace-header-pill workspace-header-pill-medium">features</span>
          </div>
        </div>
        <p className="hero-copy" style={{ marginBottom: 0 }}>
          {project.start_date} → {project.end_date} · {projectFeatures.length} features
        </p>
      </section>

      <div className="fact-strip" style={{ marginTop: 0 }}>
        <span className="fact-pill">{projectFeatures.filter(f => f.status === 'draft').length} features draft</span>
        <span className="fact-pill">{projectFeatures.filter(f => f.status === 'final').length} features final</span>
        <span className="fact-pill">{project.epic_ticket_id || 'no epic link'}</span>
      </div>

      {/* Description */}
      {project.description && (
        <InfoBlock label="Description" value={project.description} />
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '4px' }}>
        {[
          { label: 'Features Draft', value: featureDraftCount, color: '#ffe600' },
          { label: 'Features Final', value: featureFinalCount, color: '#00ff88' },
          { label: 'Project', value: 1, color: 'var(--foreground)' },
          { label: 'Squad', value: squad ? 1 : 0, color: '#00e5ff' },
          { label: 'Health', value: project.health_status.toUpperCase(), color: project.health_status === 'green' ? '#00ff88' : project.health_status === 'yellow' ? '#ffe600' : '#ff5555' },
          { label: 'Days', value: `${project.start_date} → ${project.end_date}`, color: 'var(--foreground)' }
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)',
            padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: '1px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: stat.color, fontFamily: "'Share Tech Mono', monospace" }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.05em' }}>
              {stat.label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Goals */}
      {project.goals && (
        <InfoBlock label="Goals" value={project.goals} mono />
      )}

      {/* Functionalities */}
      {project.functionalities && (
        <InfoBlock label="Functionalities" value={project.functionalities} mono />
      )}

      {/* Recent features */}
      {projectFeatures.length > 0 && (
        <div>
          <SectionLabel>Feature Requests</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {projectFeatures.map(f => (
              <button key={f.id} type="button" onClick={() => onSelect({ kind: 'feature', id: f.id, projectId: project.id })} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)',
                padding: '6px 7px', cursor: 'pointer', textAlign: 'left'
              }}>
                <Tag size={11} style={{ color: f.status === 'final' ? '#00ff88' : '#ffe600', flexShrink: 0, opacity: 0.7 }} />
                <span style={{ flex: 1, fontSize: '12px', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.title}
                </span>
                <StatusChip status={f.status} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCardGrid({
  projects,
  features,
  squads,
  selection,
  onSelect
}: {
  projects: ProjectEntity[]
  features: FeatureRequest[]
  squads: Squad[]
  selection: PMSelection
  onSelect: (sel: PMSelection) => void
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
      <div style={{
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div>
          <div className="eyebrow">Project Center</div>
          <div className="page-title" style={{ marginTop: '2px' }}>Projects</div>
        </div>
        <div className="workspace-header-meta">
          <span className="workspace-header-pill workspace-header-pill-active">
            {projects.length} total
          </span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '10px'
      }}>
        {projects.map((project) => {
          const projectFeatures = features.filter(f => f.project_id === project.id)
          const squad = squads.find(s => s.id === project.squad_id)
          const hc = healthColors[project.health_status] || healthColors.green
          const isSelected = selection.kind === 'project' && selection.id === project.id

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect({ kind: 'project', id: project.id })}
              style={{
                width: '100%',
                textAlign: 'left',
                background: isSelected ? 'rgba(0, 229, 255, 0.08)' : 'var(--cp-bg-2)',
                border: isSelected ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                padding: '14px',
                cursor: 'pointer',
                display: 'grid',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: hc.dot, boxShadow: `0 0 6px ${hc.glow}`,
                    flexShrink: 0, display: 'block'
                  }} />
                  <span style={{
                    color: 'var(--foreground)', fontSize: '13px', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {project.name}
                  </span>
                </div>
                <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: 'var(--muted-foreground)' }}>
                  {squad ? squad.name : 'Unassigned'}
                </span>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: '8px',
                fontSize: '10px', fontFamily: "'Share Tech Mono', monospace",
                color: 'var(--muted-foreground)'
              }}>
                <span>{projectFeatures.length} features</span>
                <span style={{ color: project.health_status === 'green' ? 'var(--cp-green)' : project.health_status === 'yellow' ? 'var(--cp-yellow)' : 'var(--cp-magenta)' }}>
                  {project.health_status.toUpperCase()}
                </span>
              </div>

              <div style={{
                display: 'flex', gap: '8px', flexWrap: 'wrap',
                fontSize: '9px', fontFamily: "'Share Tech Mono', monospace"
              }}>
                <span className="workspace-header-pill workspace-header-pill-open">{project.start_date}</span>
                <span className="workspace-header-pill workspace-header-pill-open">{project.end_date}</span>
                {project.epic_ticket_id && (
                  <span className="workspace-header-pill workspace-header-pill-medium">{project.epic_ticket_id}</span>
                )}
              </div>

            </button>
          )
        })}
      </div>
    </div>
  )
}

function FeatureOverview({ feature, project, allFeatures }: {
  feature: FeatureRequest
  project?: ProjectEntity
  allFeatures: FeatureRequest[]
}) {
  const siblings = allFeatures.filter(f => f.id !== feature.id && f.project_id === feature.project_id).slice(0, 5)
  const isFinal = feature.status === 'final'
  const linkedPrdIds = Array.isArray(feature.prd_ids) && feature.prd_ids.length > 0
    ? feature.prd_ids
    : feature.prd_id
    ? [feature.prd_id]
    : []

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <Tag size={18} style={{ color: isFinal ? '#00ff88' : '#ffe600', flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--foreground)', flex: 1, minWidth: 0 }}>
          {feature.title}
        </h2>
        <StatusChip status={feature.status} />
      </div>

      <div style={{
        display: 'flex', gap: '12px', fontSize: '10px', fontFamily: "'Share Tech Mono', monospace",
        color: 'var(--muted-foreground)', borderBottom: '1px solid var(--cp-border)', paddingBottom: '14px', flexWrap: 'wrap'
      }}>
        {project && <span>📁 {project.name}</span>}
        {linkedPrdIds.length > 0 && <span style={{ color: '#00ff88' }}>→ {linkedPrdIds.length} linked PRD{linkedPrdIds.length === 1 ? '' : 's'}</span>}
        <span>Updated: {new Date(feature.updated_at).toLocaleDateString()}</span>
      </div>

      {isFinal && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px',
          background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.2)',
          fontSize: '11px', fontFamily: "'Share Tech Mono', monospace", color: '#ffe600'
        }}>
          <Lock size={12} />
          Feature is finalized. Changes must go through a PRD-level change request.
        </div>
      )}

      {feature.description ? (
        <InfoBlock label="Feature Description" value={feature.description} mono />
      ) : (
        <div style={{
          padding: '20px', background: 'var(--cp-bg-2)', border: '1px dashed var(--cp-border)',
          color: 'var(--muted-foreground)', fontSize: '11px', fontStyle: 'italic', textAlign: 'center'
        }}>
          No description yet. Click EDIT in the action rail to add one.
        </div>
      )}

      {/* Project context */}
      {project && (
        <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '12px' }}>
          <SectionLabel>Project Context</SectionLabel>
          <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1.5' }}>
            <strong style={{ color: 'var(--foreground)' }}>{project.name}</strong>
            {project.description && ` — ${project.description.slice(0, 120)}${project.description.length > 120 ? '…' : ''}`}
          </div>
        </div>
      )}

      {linkedPrdIds.length > 0 && (
        <div>
          <SectionLabel>Linked PRDs</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {linkedPrdIds.map((prdId) => (
              <div
                key={prdId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  background: 'var(--cp-bg-2)',
                  border: '1px solid var(--cp-border)',
                  fontSize: '11px'
                }}
              >
                <FileText size={10} style={{ color: '#00e5ff', flexShrink: 0, opacity: 0.6 }} />
                <span style={{ color: 'var(--muted-foreground)' }}>{prdId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sibling features */}
      {siblings.length > 0 && (
        <div>
          <SectionLabel>Other Features in This Project</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {siblings.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', fontSize: '11px'
              }}>
                <Tag size={9} style={{ color: f.status === 'final' ? '#00ff88' : '#ffe600', flexShrink: 0, opacity: 0.6 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>
                  {f.title}
                </span>
                <StatusChip status={f.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PRDOverview({ prd, project, feature, linkedTickets, squads }: {
  prd: PRDDocument
  project?: ProjectEntity
  feature?: FeatureRequest
  linkedTickets: JiraTicket[]
  squads: Squad[]
}) {
  const squad = squads.find(s => s.id === prd.squadId)
  const isFinal = prd.status === 'final'
  const epics = linkedTickets.filter(t => t.issue_type === 'epic')
  const stories = linkedTickets.filter(t => t.issue_type === 'story')

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <FileText size={18} style={{ color: '#00e5ff', flexShrink: 0, opacity: 0.8 }} />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--foreground)', flex: 1, minWidth: 0 }}>
          {prd.title}
        </h2>
        <StatusChip status={prd.status} />
      </div>

      <div style={{
        display: 'flex', gap: '12px', fontSize: '10px', fontFamily: "'Share Tech Mono', monospace",
        color: 'var(--muted-foreground)', borderBottom: '1px solid var(--cp-border)', paddingBottom: '14px', flexWrap: 'wrap'
      }}>
        {project && <span>📁 {project.name}</span>}
        {squad && <span style={{ color: 'var(--cp-cyan)' }}>⬡ {squad.name}</span>}
        {feature && <span>← Feature: {feature.title}</span>}
        <span>Updated: {new Date(prd.lastUpdated).toLocaleDateString()}</span>
        {prd.confluenceUrl && (
          <a href="#" onClick={e => e.preventDefault()} style={{ color: 'var(--cp-cyan)' }}>
            Confluence →
          </a>
        )}
      </div>

      {isFinal && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
          background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.2)',
          fontSize: '11px', fontFamily: "'Share Tech Mono', monospace", color: '#ffe600'
        }}>
          <Lock size={12} />
          PRD is finalized. New changes go through change requests (append-only).
        </div>
      )}

      {/* PRD content preview */}
      {prd.content ? (
        <div>
          <SectionLabel>PRD Content</SectionLabel>
          <div style={{
            background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)',
            padding: '14px', fontSize: '12px', fontFamily: 'monospace',
            color: 'var(--foreground)', lineHeight: '1.6',
            whiteSpace: 'pre-wrap', maxHeight: '320px', overflowY: 'auto'
          }}>
            {prd.content}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '20px', background: 'var(--cp-bg-2)', border: '1px dashed var(--cp-border)',
          color: 'var(--muted-foreground)', fontSize: '11px', fontStyle: 'italic', textAlign: 'center'
        }}>
          No PRD content yet. Click EDIT in the action rail to write it.
        </div>
      )}

      {/* Linked tickets */}
      {linkedTickets.length > 0 && (
        <div>
          <SectionLabel>Linked Tickets ({linkedTickets.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {epics.map(t => (
              <div key={t.ticket_id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 10px', background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', fontSize: '11px'
              }}>
                <GitBranch size={11} style={{ color: '#ff00aa', flexShrink: 0, opacity: 0.7 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#00e5ff' }}>{t.ticket_key}</span>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#00ff88' }}>{t.story_points}SP</span>
              </div>
            ))}
            {stories.map(t => (
              <div key={t.ticket_id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '6px 10px 6px 22px', background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', fontSize: '10px'
              }}>
                <BookOpen size={10} style={{ color: '#00e5ff', flexShrink: 0, opacity: 0.6 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>{t.title}</span>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#00e5ff' }}>{t.ticket_key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Right Edit Drawer ────────────────────────────────────────────────────────

function EditDrawer({
  variant = 'drawer',
  mode, onClose,
  project, feature, prd,
  squads, activeSquadId, activeProjectId,
  onSaveProject, onSaveFeature, onSavePRD
}: {
  variant?: 'drawer' | 'modal'
  mode: PMDrawerMode
  onClose: () => void
  project?: ProjectEntity
  feature?: FeatureRequest
  prd?: PRDDocument
  squads: Squad[]
  activeSquadId: string
  activeProjectId?: string
  onSaveProject: (p: ProjectEntity) => void
  onSaveFeature: (f: FeatureRequest) => void
  onSavePRD: (p: PRDDocument) => void
}) {
  const [draft, setDraft] = useState<any>({})
  const isNew = mode.startsWith('new-')

  // Initialize draft from current entity
  useEffect(() => {
    if (mode === 'edit-project' && project) setDraft({ ...project })
    else if (mode === 'new-project') setDraft({
      id: `project_${Math.random().toString(36).slice(2, 8)}`,
      name: '', description: '', health_status: 'green',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      squad_id: activeSquadId, feature_ids: [], functionalities: '', goals: '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    })
    else if (mode === 'edit-feature' && feature) setDraft({ ...feature })
    else if (mode === 'new-feature') setDraft({
      id: `feature_${Math.random().toString(36).slice(2, 8)}`,
      project_id: activeProjectId || '',
      title: '', description: '', status: 'draft',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    })
    else if (mode === 'edit-prd' && prd) setDraft({ ...prd })
    else if (mode === 'new-prd') setDraft({
      id: `prd-${Math.random().toString(36).slice(2, 10)}`,
      title: '', content: '', status: 'draft',
      squadId: activeSquadId, project_id: activeProjectId || '',
      lastUpdated: new Date().toISOString(), epic_ids: []
    })
  }, [mode])

  const fieldStyle: React.CSSProperties = {
    width: '100%', background: 'var(--cp-bg-3)',
    border: '1px solid var(--cp-border)', color: 'var(--foreground)',
    fontSize: '12px', padding: '8px 10px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s'
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '9px', fontFamily: "'Share Tech Mono', monospace",
    color: 'var(--section-label)', letterSpacing: '0.08em', opacity: 0.6, marginBottom: '4px'
  }

  function handleSave() {
    if (mode === 'edit-project' || mode === 'new-project') {
      onSaveProject({ ...draft, updated_at: new Date().toISOString() })
    } else if (mode === 'edit-feature' || mode === 'new-feature') {
      onSaveFeature({ ...draft, updated_at: new Date().toISOString() })
    } else if (mode === 'edit-prd' || mode === 'new-prd') {
      onSavePRD({ ...draft, lastUpdated: new Date().toISOString() })
    }
    onClose()
  }

  const title = {
    'view-project': 'Project Details',
    'edit-project': 'Edit Project',
    'new-project': 'New Project',
    'edit-feature': 'Edit Feature',
    'new-feature': 'New Feature Request',
    'edit-prd': 'Edit PRD',
    'new-prd': 'New PRD',
    'athena': 'Athena',
    'closed': ''
  }[mode] || ''

  const isProject = mode === 'edit-project' || mode === 'new-project'
  const isFeature = mode === 'edit-feature' || mode === 'new-feature'
  const isPrd = mode === 'edit-prd' || mode === 'new-prd'
  const isAthena = mode === 'athena'
  const isFinalLocked = (isFeature && draft.status === 'final') || (isPrd && draft.status === 'final')

  return (
    <div style={{
      width: variant === 'modal' ? '780px' : '100%', minWidth: variant === 'modal' ? '780px' : '100%', flexShrink: 0,
      borderLeft: variant === 'modal' ? '0' : '1px solid var(--cp-border)',
      background: 'var(--cp-bg-1)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: variant === 'modal' ? 'none' : 'slideInLeft 0.2s ease-out'
    }}>
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      {/* Drawer header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--cp-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--cp-bg-2)', flexShrink: 0
      }}>
        <span style={{
          fontSize: '10px', fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: '0.1em', color: 'var(--section-label)',
          fontWeight: 700
        }}>
          {title.toUpperCase()}
        </span>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none',
          color: 'var(--muted-foreground)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', padding: '2px'
        }}>
          <X size={14} />
        </button>
      </div>

      {/* Drawer body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {isFinalLocked && (
          <div style={{
            padding: '10px 12px', background: 'rgba(255,170,0,0.06)',
            border: '1px solid rgba(255,170,0,0.2)',
            fontSize: '11px', fontFamily: "'Share Tech Mono', monospace",
            color: '#ffe600', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <Lock size={11} /> This item is finalized and locked.
          </div>
        )}

        {/* Athena view */}
        {isAthena && (
          <>
            <div style={{
              padding: '12px 14px',
              border: '1px solid rgba(0,229,255,0.2)',
              background: 'rgba(0,229,255,0.04)',
              fontSize: '12px',
              lineHeight: 1.6,
              color: 'var(--foreground)'
            }}>
              Athena is loaded with the current project context. Use this drawer to draft updates for the project, feature, or PRD flow.
            </div>
            <div>
              <label style={labelStyle}>ATHENA PROMPT</label>
              <textarea
                placeholder="Ask Athena to update the project, write a feature request, or draft a PRD..."
                style={{ ...fieldStyle, minHeight: '220px', resize: 'vertical', fontFamily: 'monospace' }}
              />
            </div>
          </>
        )}

        {/* Project fields */}
        {isProject && (
          <>
            <div>
              <label style={labelStyle}>PROJECT NAME *</label>
              <input
                value={draft.name || ''}
                onChange={e => setDraft((d: any) => ({ ...d, name: e.target.value }))}
                style={fieldStyle}
                placeholder="Project name"
              />
            </div>
            <div>
              <label style={labelStyle}>DESCRIPTION</label>
              <textarea
                value={draft.description || ''}
                onChange={e => setDraft((d: any) => ({ ...d, description: e.target.value }))}
                style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' }}
                placeholder="Brief project description…"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>HEALTH STATUS</label>
                <select
                  value={draft.health_status || 'green'}
                  onChange={e => setDraft((d: any) => ({ ...d, health_status: e.target.value }))}
                  style={fieldStyle}
                >
                  <option value="green">● Green</option>
                  <option value="yellow">● Yellow</option>
                  <option value="red">● Red</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>SQUAD</label>
                <select
                  value={draft.squad_id || ''}
                  onChange={e => setDraft((d: any) => ({ ...d, squad_id: e.target.value }))}
                  style={fieldStyle}
                >
                  <option value="">Unassigned</option>
                  {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>START DATE</label>
                <input
                  type="date" value={draft.start_date || ''}
                  onChange={e => setDraft((d: any) => ({ ...d, start_date: e.target.value }))}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>END DATE</label>
                <input
                  type="date" value={draft.end_date || ''}
                  onChange={e => setDraft((d: any) => ({ ...d, end_date: e.target.value }))}
                  style={fieldStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>GOALS (MARKDOWN)</label>
              <textarea
                value={draft.goals || ''}
                onChange={e => setDraft((d: any) => ({ ...d, goals: e.target.value }))}
                style={{ ...fieldStyle, minHeight: '100px', resize: 'vertical', fontFamily: 'monospace' }}
                placeholder="## Project Goals&#10;1. ..."
              />
            </div>
            <div>
              <label style={labelStyle}>FUNCTIONALITIES (MARKDOWN)</label>
              <textarea
                value={draft.functionalities || ''}
                onChange={e => setDraft((d: any) => ({ ...d, functionalities: e.target.value }))}
                style={{ ...fieldStyle, minHeight: '100px', resize: 'vertical', fontFamily: 'monospace' }}
                placeholder="## Core Functionalities&#10;- **Feature**: ..."
              />
            </div>
          </>
        )}

        {/* Feature fields */}
        {isFeature && (
          <>
            <div>
              <label style={labelStyle}>FEATURE TITLE *</label>
              <input
                value={draft.title || ''}
                onChange={e => !isFinalLocked && setDraft((d: any) => ({ ...d, title: e.target.value }))}
                disabled={isFinalLocked}
                style={{ ...fieldStyle, opacity: isFinalLocked ? 0.5 : 1 }}
                placeholder="Feature request title"
              />
            </div>
            <div>
              <label style={labelStyle}>STATUS</label>
              <select
                value={draft.status || 'draft'}
                onChange={e => setDraft((d: any) => ({ ...d, status: e.target.value }))}
                style={fieldStyle}
              >
                <option value="draft">DRAFT</option>
                <option value="final">FINAL (locked)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>DESCRIPTION (MARKDOWN)</label>
              <textarea
                value={draft.description || ''}
                onChange={e => !isFinalLocked && setDraft((d: any) => ({ ...d, description: e.target.value }))}
                disabled={isFinalLocked}
                style={{ ...fieldStyle, minHeight: '200px', resize: 'vertical', fontFamily: 'monospace', opacity: isFinalLocked ? 0.5 : 1 }}
                placeholder={`## Overview\nWhat does this feature do?\n\n## User Story\nAs a [role], I want [feature] so that [benefit]\n\n## Acceptance Criteria\n- [ ] Criterion 1`}
              />
            </div>
          </>
        )}

        {/* PRD fields */}
        {isPrd && (
          <>
            <div>
              <label style={labelStyle}>PRD TITLE *</label>
              <input
                value={draft.title || ''}
                onChange={e => !isFinalLocked && setDraft((d: any) => ({ ...d, title: e.target.value }))}
                disabled={isFinalLocked}
                style={{ ...fieldStyle, opacity: isFinalLocked ? 0.5 : 1 }}
                placeholder="PRD title"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>STATUS</label>
                <select
                  value={draft.status || 'draft'}
                  onChange={e => setDraft((d: any) => ({ ...d, status: e.target.value }))}
                  style={fieldStyle}
                >
                  <option value="draft">DRAFT</option>
                  <option value="final">FINAL</option>
                  <option value="ready">READY</option>
                  <option value="synced">SYNCED</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>SQUAD</label>
                <select
                  value={draft.squadId || ''}
                  onChange={e => setDraft((d: any) => ({ ...d, squadId: e.target.value }))}
                  style={fieldStyle}
                >
                  <option value="">Unassigned</option>
                  {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>PRD CONTENT (MARKDOWN)</label>
              <textarea
                value={draft.content || ''}
                onChange={e => !isFinalLocked && setDraft((d: any) => ({ ...d, content: e.target.value }))}
                disabled={isFinalLocked}
                style={{ ...fieldStyle, minHeight: '280px', resize: 'vertical', fontFamily: 'monospace', opacity: isFinalLocked ? 0.5 : 1 }}
                placeholder={`# PRD Title\n\n## Overview\n\n## Goals\n\n## User Stories\n\n### Epic 1:\n- Story 1.1: As a user, I want…\n\n## Acceptance Criteria\n- [ ] \n\n## Out of Scope\n`}
              />
            </div>
          </>
        )}
      </div>

      {/* Drawer footer */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--cp-border)',
        display: 'flex', gap: '8px', background: 'var(--cp-bg-2)', flexShrink: 0
      }}>
        {!isAthena && (
          <button
            onClick={handleSave}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.35)',
              color: 'var(--cp-cyan)', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace",
              fontWeight: 700, letterSpacing: '0.08em', padding: '9px', cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0,229,255,0.2)'
              e.currentTarget.style.borderColor = 'var(--cp-cyan)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0,229,255,0.1)'
              e.currentTarget.style.borderColor = 'rgba(0,229,255,0.35)'
            }}
          >
            <Save size={13} />
            {isNew ? 'CREATE' : 'SAVE CHANGES'}
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: '9px 16px', background: 'transparent',
            border: '1px solid var(--cp-border)', color: 'var(--muted-foreground)',
            fontSize: '11px', fontFamily: "'Share Tech Mono', monospace",
            cursor: 'pointer',
            flex: isAthena ? 1 : '0 0 auto'
          }}
        >
          CLOSE
        </button>
      </div>
    </div>
  )
}

// ─── Main ProductManagerPanel ─────────────────────────────────────────────────

export function ProductManagerPanel({
  projects, features, prds, tickets, squads, sprintPlans = [], activeSquadId,
  onSaveProject, onSaveFeature, onDeleteFeature, onSavePRD, onDeletePRD,
  onConvertFeatureToPRD, onOpenAthena, onNewProject, onSelectionChange, onRequestEditProject, onRequestDeleteProject, onProjectDrawerChange, projectActionSignal, selectedPrdId, onSelectPrd, onGeneratePlan, openInitialProject
}: PMPanelProps) {
  const [selection, setSelection] = useState<PMSelection>({ kind: 'none' })
  const [drawerMode, setDrawerMode] = useState<PMDrawerMode>('closed')
  const [projectTab, setProjectTab] = useState<'project' | 'features' | 'prds'>('project')
  const [reviewPlan, setReviewPlan] = useState<{ prd: PRDDocument; tickets: GeneratedPlanTicket[] } | null>(null)
  const [reviewSprintId, setReviewSprintId] = useState('')
  const [finalizationState, setFinalizationState] = useState<'idle' | 'finalizing' | 'success' | 'error'>('idle')
  const [finalizationError, setFinalizationError] = useState('')
  const [generatedEpicIds, setGeneratedEpicIds] = useState<Set<string>>(new Set())

  // Keep the two top-level pages distinct:
  // - Overview is an unscoped landing page.
  // - Project opens the first project directly into its project overview.
  // Reset the local selection when navigating back to Overview so a project
  // drawer cannot remain mounted over the landing page.
  useEffect(() => {
    if (openInitialProject) {
      if (selection.kind !== 'none' || !projects.length) return
      const firstProject = projects[0]
      const firstSelection = { kind: 'project' as const, id: firstProject.id }
      setSelection(firstSelection)
      setDrawerMode('view-project')
      onProjectDrawerChange?.(true)
      onSelectionChange?.(firstSelection, firstProject)
      return
    }

    if (selection.kind !== 'none' || drawerMode !== 'closed') {
      setSelection({ kind: 'none' })
      setDrawerMode('closed')
      onProjectDrawerChange?.(false)
      onSelectionChange?.({ kind: 'none' })
    }
  }, [projects, selection.kind, drawerMode, onSelectionChange, onProjectDrawerChange, openInitialProject])

  // Sync external PRD selection
  useEffect(() => {
    if (selectedPrdId && (selection.kind !== 'prd' || (selection as any).id !== selectedPrdId)) {
      const prd = prds.find(p => p.id === selectedPrdId)
      setSelection({ kind: 'prd', id: selectedPrdId, projectId: prd?.project_id })
    }
  }, [selectedPrdId])

  const selectedProject = selection.kind === 'project' ? projects.find(p => p.id === (selection as any).id)
    : selection.kind === 'feature' ? projects.find(p => p.id === (selection as any).projectId)
    : selection.kind === 'prd' ? projects.find(p => p.id === (selection as any).projectId)
    : undefined
  const projectPrds = selectedProject ? prds.filter((p) => p.project_id === selectedProject.id) : []

  const selectedFeature = selection.kind === 'feature'
    ? features.find(f => f.id === (selection as any).id) : undefined

  const selectedPrd = selection.kind === 'prd'
    ? prds.find(p => p.id === (selection as any).id) : undefined

  const linkedTickets = selectedPrd ? tickets.filter(t => t.prd_id === selectedPrd.id) : []

  const originFeature = selectedPrd?.feature_id
    ? features.find(f => f.id === selectedPrd.feature_id) : undefined

  function handleSelect(sel: PMSelection) {
    setSelection(sel)
    setProjectTab(sel.kind === 'feature' ? 'features' : 'project')
    setDrawerMode(sel.kind === 'none' ? 'closed' : 'view-project')
    onProjectDrawerChange?.(sel.kind !== 'none')
    const selected = sel.kind === 'project'
      ? projects.find(p => p.id === sel.id)
      : sel.kind === 'feature' ? projects.find(p => p.id === sel.projectId)
      : sel.kind === 'prd' ? projects.find(p => p.id === sel.projectId)
      : undefined
    onSelectionChange?.(sel, selected)
    if (sel.kind === 'prd') {
      onSelectPrd?.((sel as any).id)
    }
  }

  function handleSetDrawer(mode: PMDrawerMode) {
    setDrawerMode(mode)
    onProjectDrawerChange?.(mode === 'view-project')
  }

  function handleDeleteSelected() {
    if (selection.kind === 'feature') {
      if (confirm('Delete this feature request?')) {
        onDeleteFeature((selection as any).id)
        setSelection({ kind: 'project', id: (selection as any).projectId })
        setDrawerMode('closed')
        onProjectDrawerChange?.(false)
      }
    } else if (selection.kind === 'prd') {
      if (confirm('Delete this PRD?')) {
        onDeletePRD((selection as any).id)
        onSelectPrd?.(null)
        const projectId = (selection as any).projectId
        setSelection(projectId ? { kind: 'project', id: projectId } : { kind: 'none' })
        setDrawerMode('closed')
        onProjectDrawerChange?.(false)
      }
    }
  }

  const currentProject = selection.kind === 'project'
    ? projects.find(p => p.id === selection.id)
    : selection.kind === 'feature' ? projects.find(p => p.id === selection.projectId)
    : undefined

  function handleCreatePrdForCurrentProject(project: ProjectEntity) {
    setSelection({ kind: 'project', id: project.id })
    setProjectTab('project')
    setDrawerMode('new-prd')
    onProjectDrawerChange?.(true)
  }

  function handleConvertToPRD() {
    if (!selectedFeature) return
    const newPrd = onConvertFeatureToPRD(selectedFeature)
    onSelectPrd?.(newPrd.id)
    setSelection({ kind: 'prd', id: newPrd.id, projectId: selectedFeature.project_id })
    setDrawerMode('closed')
    onProjectDrawerChange?.(false)
  }

  function handleProjectAthena() {
    if (!currentProject) return
    onOpenAthena(`project:${currentProject.id}`, 'project', {
      project: {
        id: currentProject.id,
        name: currentProject.name,
        description: currentProject.description,
        goals: currentProject.goals,
        functionalities: currentProject.functionalities,
        feature_count: features.filter(f => f.project_id === currentProject.id).length,
        features_summary: features.filter(f => f.project_id === currentProject.id).map(f => ({
          id: f.id, title: f.title, status: f.status
        }))
      }
    })
    setDrawerMode('athena')
    onProjectDrawerChange?.(false)
  }

  function handleNewProject() {
    setDrawerMode('new-project')
    onNewProject?.()
  }

  function handleGenerateEpic(prd: PRDDocument) {
    const epic = generateOneLineEpic(prd.title, prd.content)
    onSavePRD({ ...prd, epic_summary: epic, lastUpdated: new Date().toISOString() })
    setGeneratedEpicIds((current) => {
      const next = new Set(current)
      next.add(prd.id)
      return next
    })
  }

  async function handleFinalizeAcceptedStories() {
    if (!reviewPlan || !onGeneratePlan) {
      setFinalizationState('error')
      setFinalizationError('Unable to finalize stories because the planning handler is unavailable.')
      return
    }

    const acceptedTickets = reviewPlan.tickets.filter((ticket) => ticket.review_status === 'accepted')
    if (!acceptedTickets.length) return

    setFinalizationState('finalizing')
    setFinalizationError('')
    try {
      await onGeneratePlan(reviewPlan.prd, acceptedTickets, reviewSprintId || undefined)
      setReviewPlan(null)
      setFinalizationState('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The accepted stories could not be finalized.'
      setFinalizationState('error')
      setFinalizationError(message)
      console.error('Failed to finalize accepted stories', error)
    }
  }

  function handleRequestEditCurrentProject() {
    if (!currentProject) return
    onRequestEditProject?.(currentProject)
    setDrawerMode('edit-project')
    onProjectDrawerChange?.(true)
  }

  function handleRequestDeleteCurrentProject() {
    if (!currentProject) return
    onRequestDeleteProject?.(currentProject)
  }

  function handleCreateFeatureForCurrentProject(project: ProjectEntity) {
    setSelection({ kind: 'project', id: project.id })
    setProjectTab('features')
    setDrawerMode('new-feature')
    onProjectDrawerChange?.(true)
  }

  useEffect(() => {
    if (!projectActionSignal) return
    if (!currentProject || currentProject.id !== projectActionSignal.projectId) return
    if (projectActionSignal.type === 'edit') {
      setDrawerMode('edit-project')
      onProjectDrawerChange?.(true)
    }
    if (projectActionSignal.type === 'delete') handleDeleteSelected()
    if (projectActionSignal.type === 'athena') handleProjectAthena()
    if (projectActionSignal.type === 'create-feature') handleCreateFeatureForCurrentProject(currentProject)
  }, [projectActionSignal?.nonce])

  function buildAthenaContext() {
    const contextData: Record<string, unknown> = {}
    if (selectedProject) {
      contextData.project = {
        id: selectedProject.id, name: selectedProject.name,
        description: selectedProject.description, goals: selectedProject.goals,
        functionalities: selectedProject.functionalities,
        feature_count: features.filter(f => f.project_id === selectedProject.id).length,
        features_summary: features.filter(f => f.project_id === selectedProject.id)
          .map(f => ({ id: f.id, title: f.title, status: f.status }))
      }
    }
    if (selectedFeature) {
      contextData.feature = {
        id: selectedFeature.id, title: selectedFeature.title,
        description: selectedFeature.description, status: selectedFeature.status
      }
    }
    if (selectedPrd) {
      contextData.prd = {
        id: selectedPrd.id, title: selectedPrd.title,
        content: selectedPrd.content, status: selectedPrd.status
      }
    }
    const contextKey = selectedFeature ? `feature:${selectedFeature.id}`
      : selectedPrd ? `prd:${selectedPrd.id}`
      : selectedProject ? `project:${selectedProject.id}`
      : 'projects:global'
    const contextKind = selectedPrd ? 'prd' : 'project'
    onOpenAthena(contextKey, contextKind, contextData)
  }

  const drawerOpen = drawerMode !== 'closed'
  const activeProjectId = selectedProject?.id
    || (selection.kind === 'feature' ? (selection as any).projectId : undefined)
    || (selection.kind === 'prd' ? (selection as any).projectId : undefined)

  useEffect(() => {
    if (!drawerOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerMode('closed')
        onProjectDrawerChange?.(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen])

  const productStages = [
    { label: 'PROJECTS', color: '#00e5ff', count: projects.length, items: projects.slice(0, 3).map((item) => ({ id: item.id, text: item.name, sel: selection.kind === 'project' && selection.id === item.id, click: () => handleSelect({ kind: 'project', id: item.id }) })) },
    { label: 'FEATURES', color: '#a78bfa', count: selectedProject ? features.filter((item) => item.project_id === selectedProject.id).length : features.length, items: (selectedProject ? features.filter((item) => item.project_id === selectedProject.id) : features).slice(0, 3).map((item) => ({ id: item.id, text: item.title, sel: selection.kind === 'feature' && selection.id === item.id, click: () => handleSelect({ kind: 'feature', id: item.id, projectId: item.project_id }) })) },
    { label: 'STORIES', color: '#f59e0b', count: tickets.filter((item) => !selectedProject || item.project_id === selectedProject.id).length, items: tickets.filter((item) => !selectedProject || item.project_id === selectedProject.id).slice(0, 3).map((item) => ({ id: item.ticket_id, text: `${item.ticket_key} · ${item.title}`, sel: false, click: () => item.prd_id && handleSelect({ kind: 'prd', id: item.prd_id, projectId: selectedProject?.id }) })) }
  ]
  const deliveryStages = [
    { label: 'TEAMS', color: '#34d399', count: squads.reduce((sum, squad) => sum + squad.developers.length, 0), items: [{ id: 'team-members', text: `${squads.reduce((sum, squad) => sum + squad.developers.length, 0)} people available`, sel: false, click: () => undefined }] },
    { label: 'SQUADS', color: '#fb7185', count: squads.length, items: squads.slice(0, 3).map((item) => ({ id: item.id, text: `${item.name} · ${item.developers.length} members`, sel: item.id === activeSquadId, click: () => undefined })) }
  ]
  const activeSquad = squads.find((squad) => squad.id === activeSquadId)
  const renderStageCard = (stage: typeof productStages[number]) => <div key={stage.label} style={{ minWidth: '190px', minHeight: '126px', flex: '1 1 0', padding: '16px', background: `linear-gradient(145deg, ${stage.color}18, var(--cp-bg-2) 72%)`, border: `1px solid ${stage.color}88`, borderRadius: '12px', boxShadow: `0 10px 30px ${stage.color}18, inset 0 1px 0 rgba(255,255,255,0.08)`, position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', top: '-18px', right: '-12px', width: '70px', height: '70px', borderRadius: '50%', background: `${stage.color}16`, filter: 'blur(2px)' }} /><SectionLabel>{stage.label}</SectionLabel><div style={{ fontSize: '30px', color: stage.color, fontWeight: 800, lineHeight: 1.1, margin: '8px 0 4px' }}>{stage.count}</div>{stage.items.map((item) => <button key={item.id} type="button" onClick={item.click} style={{ width: '100%', textAlign: 'left', marginTop: '8px', padding: '8px 9px', color: 'var(--foreground)', background: item.sel ? `${stage.color}24` : 'rgba(0,0,0,0.24)', border: `1px solid ${item.sel ? stage.color : 'var(--cp-border)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '10px', position: 'relative' }}>{item.text}</button>)}</div>

  return (
    <div style={{
      display: 'flex', flex: 1, overflow: 'hidden', height: '100%',
      background: 'var(--cp-bg-0)',
      position: 'relative'
    }}>
      {/* ── Left: Project Tree ── */}
      <ProjectTree
        projects={projects}
        features={features}
        squads={squads}
        selection={selection}
        onSelect={handleSelect}
        onNewProject={handleNewProject}
      />

      {/* ── Center: Product track + Delivery track → Sprint planning ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <section className="hero-panel" style={{ margin: '8px 10px 0' }}>
          <div className="panel-head">
            <div>
              <div className="eyebrow">Forge Overview</div>
              <div className="workspace-header-title-row">
                <h1 className="page-title">PRODUCT + DELIVERY OVERVIEW</h1>
                <div className="workspace-header-meta"><span className="workspace-header-pill workspace-header-pill-active">stories + squad</span></div>
              </div>
              <div style={{ color: 'var(--muted-foreground)', fontSize: '11px', marginTop: '5px' }}>Define the work, choose who delivers it, then plan the sprint.</div>
            </div>
            <button type="button" onClick={handleNewProject} style={{ border: '1px solid var(--cp-cyan)', background: 'rgba(0,229,255,0.08)', color: 'var(--cp-cyan)', padding: '8px 10px', fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', cursor: 'pointer' }}>+ START PROJECT</button>
          </div>
        </section>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 26px' }}>
          <SectionLabel>PRODUCT TRACK · PROJECT → FEATURE → STORIES</SectionLabel>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'stretch', overflowX: 'auto', padding: '6px 0 14px' }}>{productStages.map(renderStageCard)}</div>
          <SectionLabel>DELIVERY TRACK · TEAMS → SQUADS</SectionLabel>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'stretch', overflowX: 'auto', padding: '6px 0 14px' }}>{deliveryStages.map(renderStageCard)}</div>
          <SectionLabel>PLANNING OUTCOME · STORIES + SQUAD → SPRINT</SectionLabel>
          <div style={{ margin: '6px 0 18px', padding: '18px', border: '1px solid #facc1588', borderRadius: '14px', background: 'radial-gradient(circle at 50% 0%, rgba(250,204,21,0.14), rgba(250,204,21,0.035) 52%, var(--cp-bg-2) 100%)', boxShadow: '0 14px 40px rgba(250,204,21,0.12)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div><div style={{ color: '#facc15', fontSize: '17px', fontWeight: 800, letterSpacing: '0.03em' }}>SPRINT READINESS</div><div style={{ color: 'var(--muted-foreground)', fontSize: '11px', marginTop: '3px' }}>Approved stories + selected squad = a sprint-ready scope</div></div>
              <div style={{ padding: '6px 10px', borderRadius: '999px', border: '1px solid #facc1566', color: '#facc15', fontSize: '9px', letterSpacing: '0.08em' }}>{activeSquad ? `SQUAD · ${activeSquad.name}` : 'SELECT A SQUAD'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
              <div style={{ padding: '12px', borderRadius: '9px', background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b55' }}><SectionLabel>PRODUCT INPUT</SectionLabel><strong style={{ display: 'block', color: '#f59e0b', fontSize: '24px', marginTop: '4px' }}>{linkedTickets.filter((item) => item.review_status === 'accepted').length}</strong><span style={{ color: 'var(--muted-foreground)', fontSize: '10px' }}>stories ready</span></div>
              <div style={{ color: '#facc15', fontSize: '24px', fontWeight: 800 }}>+</div>
              <div style={{ padding: '12px', borderRadius: '9px', background: 'rgba(251,113,133,0.12)', border: '1px solid #fb718555' }}><SectionLabel>DELIVERY INPUT</SectionLabel><strong style={{ display: 'block', color: '#fb7185', fontSize: '18px', marginTop: '7px' }}>{activeSquad?.name || 'No squad selected'}</strong><span style={{ color: 'var(--muted-foreground)', fontSize: '10px' }}>{activeSquad ? `${activeSquad.developers.length} members` : 'choose a delivery group'}</span></div>
              <div style={{ color: '#facc15', fontSize: '24px', fontWeight: 800 }}>→</div>
              <div style={{ padding: '12px', borderRadius: '9px', background: 'rgba(250,204,21,0.14)', border: '1px solid #facc1588' }}><SectionLabel>COMMITMENT</SectionLabel><strong style={{ display: 'block', color: '#facc15', fontSize: '18px', marginTop: '7px' }}>{tickets.filter((item) => Boolean(item.sprint_id)).length} in sprint</strong><span style={{ color: 'var(--muted-foreground)', fontSize: '10px' }}>scope to plan</span></div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
            {[['Feature briefs (PRDs)', projectPrds.length, 'feature intent captured locally'], ['Stories ready for planning', linkedTickets.filter((item) => item.review_status === 'accepted').length, 'accepted and ready for a squad'], ['Stories without an owner', tickets.filter((item) => !item.assignee && !item.suggested_owner).length, 'assign before finalizing']].map(([label, count, hint]) => <div key={String(label)} style={{ padding: '12px', border: '1px solid var(--cp-border)', background: 'var(--cp-bg-2)' }}><SectionLabel>{label}</SectionLabel><strong style={{ color: 'var(--cp-cyan)', fontSize: '20px' }}>{count}</strong><div style={{ color: 'var(--muted-foreground)', fontSize: '10px', marginTop: '4px' }}>{hint}</div></div>)}
          </div>
          <div style={{ marginTop: '14px', padding: '12px', border: '1px solid var(--cp-border)', background: 'rgba(0,229,255,0.025)', color: 'var(--muted-foreground)', fontSize: '11px' }}><strong style={{ color: 'var(--cp-cyan)' }}>PLANNING RULE · </strong>Stories come from the Product track. Squads come from the Delivery track. Sprint planning brings them together.</div>
        </div>
      </div>

      {/* ── Right Drawer (slides in from right) ── */}
      {drawerOpen && drawerMode === 'view-project' && selectedProject && (
        <div style={{ position: 'absolute', inset: '0', zIndex: 20, overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', borderLeft: '1px solid var(--cp-border)', background: 'var(--cp-bg-1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideViewDrawerIn 650ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <style>{`
              @keyframes slideViewDrawerIn {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); opacity: 1; }
              }
            `}</style>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--cp-bg-2)' }}>
              <div>
                <div style={{ fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.12em', color: 'var(--section-label)', textTransform: 'uppercase' }}>
                  PROJECT OVERVIEW
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--cp-cyan)' }}>
                  {selectedProject.name}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestEditCurrentProject}
                style={{ border: '1px solid var(--cp-border)', background: 'transparent', color: 'var(--cp-cyan)', padding: '4px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: '10px' }}
              >
                EDIT
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', borderBottom: '1px solid var(--cp-border)', background: 'var(--cp-bg-1)' }}>
              {[
                ['project', 'PROJECT'],
                ['features', 'FEATURES'],
                ['prds', 'PRDS']
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setProjectTab(key as any)}
                  style={{
                    padding: '6px 10px',
                    border: projectTab === key ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                    background: projectTab === key ? 'rgba(0,229,255,0.08)' : 'transparent',
                    color: projectTab === key ? 'var(--cp-cyan)' : 'var(--muted-foreground)',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                    cursor: 'pointer'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {projectTab === 'project' && (
            <ProjectOverview
              project={selectedProject}
              features={features}
              prds={prds}
              squads={squads}
              onSelect={handleSelect}
            />
            )}
            {projectTab === 'features' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <SectionLabel>Feature Requests in Project</SectionLabel>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {features.filter((item) => item.project_id === selectedProject.id).length > 0 ? (
                    features.filter((item) => item.project_id === selectedProject.id).map((feature) => (
                      <button
                        key={feature.id}
                        type="button"
                        onClick={() => setSelection({ kind: 'feature', id: feature.id, projectId: selectedProject.id })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: selection.kind === 'feature' && selection.id === feature.id ? 'rgba(0,229,255,0.08)' : 'var(--cp-bg-2)',
                          border: selection.kind === 'feature' && selection.id === feature.id ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                          padding: '10px 12px',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <Tag size={12} style={{ color: feature.status === 'final' ? '#00ff88' : '#ffe600', flexShrink: 0, opacity: 0.7 }} />
                        <span style={{ flex: 1, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {feature.title}
                        </span>
                        <StatusChip status={feature.status} />
                        {getFeaturePrdIds(feature).length > 0 && (
                          <span style={{ fontSize: '9px', fontFamily: "'Share Tech Mono', monospace", color: '#00ff88', opacity: 0.7 }}>
                            {getFeaturePrdIds(feature).length} PRD{getFeaturePrdIds(feature).length === 1 ? '' : 's'}
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div style={{ padding: '18px', color: 'var(--muted-foreground)', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace" }}>
                      No features yet.
                    </div>
                  )}
                </div>
              </div>
            )}
            {projectTab === 'prds' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <SectionLabel>PRDs in Project</SectionLabel>
                <div style={{ display: 'grid', gap: '7px' }}>
                  {projectPrds.length === 0 && <div style={{ padding: '18px', color: 'var(--muted-foreground)', fontSize: '11px' }}>No PRDs yet. Convert a feature to create one.</div>}
                  {projectPrds.map((prd) => {
                    const epic = prd.epic_summary || generateOneLineEpic(prd.title, prd.content)
                    const prdStories = tickets.filter((ticket) => ticket.prd_id === prd.id && ticket.issue_type === 'story')
                    return <div key={prd.id} style={{ padding: '10px', border: selection.kind === 'prd' && selection.id === prd.id ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)', background: 'var(--cp-bg-2)' }}>
                      <button type="button" onClick={() => handleSelect({ kind: 'prd', id: prd.id, projectId: prd.project_id })} style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', border: 0, background: 'transparent', color: 'var(--foreground)', textAlign: 'left', cursor: 'pointer', padding: 0 }}><FileText size={12} style={{ color: 'var(--cp-cyan)' }} /><span style={{ flex: 1, fontSize: '11px' }}>{prd.title}</span><StatusChip status={prd.status} /></button>
                      <div style={{ margin: '8px 0', color: 'var(--muted-foreground)', fontSize: '10px' }}>
                        EPIC · {epic}
                        {generatedEpicIds.has(prd.id) && <span role="status" aria-live="polite" style={{ marginLeft: '8px', color: 'var(--cp-green)', fontFamily: "'Share Tech Mono', monospace", fontSize: '9px' }}>SAVED</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => handleGenerateEpic(prd)} style={{ padding: '5px 8px', border: '1px solid var(--cp-cyan)', background: 'rgba(0,229,255,0.08)', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', cursor: 'pointer' }}>{generatedEpicIds.has(prd.id) ? 'EPIC SAVED' : 'GENERATE EPIC'}</button>
                        <button type="button" onClick={() => { setReviewPlan({ prd: { ...prd, epic_summary: epic }, tickets: decomposeEpicIntoTickets(epic) }); setReviewSprintId('') }} style={{ padding: '5px 8px', border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', cursor: 'pointer' }}>GENERATE STORIES</button>
                      </div>
                      {prdStories.length > 0 && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--cp-border)' }}>
                          <div style={{ color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '0.08em', marginBottom: '5px' }}>
                            ACCEPTED STORIES ({prdStories.length})
                          </div>
                          <div style={{ display: 'grid', gap: '3px' }}>
                            {prdStories.map((story) => (
                              <div key={story.ticket_id} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 6px', background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', fontSize: '10px' }}>
                                <BookOpen size={10} style={{ color: 'var(--cp-cyan)', flexShrink: 0 }} />
                                <span style={{ color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", fontSize: '9px' }}>{story.ticket_key}</span>
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--foreground)' }} title={story.title}>{story.title}</span>
                                <span style={{ color: 'var(--cp-green)', fontFamily: "'Share Tech Mono', monospace", fontSize: '8px' }}>ACCEPTED</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  })}
                </div>
                {reviewPlan && <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.05)' }}>
                  <SectionLabel>Review generated stories before finalizing</SectionLabel>
                  <select aria-label="Planning sprint" value={reviewSprintId} onChange={(event) => setReviewSprintId(event.target.value)} style={{ width: '100%', marginBottom: '8px', background: 'var(--cp-bg-2)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', fontSize: '10px', padding: '4px' }}><option value="">Backlog (no sprint)</option>{sprintPlans.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select>
                  {reviewPlan.tickets.map((ticket, index) => <div key={ticket.id} style={{ padding: '8px', marginBottom: '7px', border: '1px solid var(--cp-border)', background: 'var(--cp-bg-2)', opacity: ticket.review_status === 'rejected' ? 0.55 : 1 }}>
                    <input aria-label={`Story ${index + 1} title`} value={ticket.title} onChange={(event) => setReviewPlan({ ...reviewPlan, tickets: reviewPlan.tickets.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} style={{ width: '100%', boxSizing: 'border-box', marginBottom: '5px', background: 'transparent', color: 'var(--foreground)', border: '1px solid var(--cp-border)', padding: '5px', fontSize: '11px' }} />
                    <textarea aria-label={`Story ${index + 1} description`} value={ticket.description} onChange={(event) => setReviewPlan({ ...reviewPlan, tickets: reviewPlan.tickets.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) })} rows={2} style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', color: 'var(--foreground)', border: '1px solid var(--cp-border)', padding: '5px', fontSize: '10px' }} />
                    <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}><select aria-label={`Story ${index + 1} squad`} value={ticket.suggested_squad || ''} onChange={(event) => setReviewPlan({ ...reviewPlan, tickets: reviewPlan.tickets.map((item, itemIndex) => itemIndex === index ? { ...item, suggested_squad: event.target.value, suggested_owner: '' } : item) })} style={{ flex: 1, background: 'var(--cp-bg-2)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', fontSize: '10px' }}><option value="">Squad</option>{squads.map((squad) => <option key={squad.id} value={squad.name}>{squad.name}</option>)}</select><select aria-label={`Story ${index + 1} owner`} value={ticket.suggested_owner || ''} onChange={(event) => setReviewPlan({ ...reviewPlan, tickets: reviewPlan.tickets.map((item, itemIndex) => itemIndex === index ? { ...item, suggested_owner: event.target.value } : item) })} style={{ flex: 1, background: 'var(--cp-bg-2)', color: 'var(--foreground)', border: '1px solid var(--cp-border)', fontSize: '10px' }}><option value="">Owner</option>{(squads.find((squad) => squad.name === ticket.suggested_squad)?.developers || []).map((developer) => <option key={developer.id || developer.name} value={developer.name}>{developer.name}</option>)}</select><button type="button" aria-pressed={ticket.review_status === 'accepted'} onClick={() => setReviewPlan({ ...reviewPlan, tickets: reviewPlan.tickets.map((item, itemIndex) => itemIndex === index ? { ...item, review_status: 'accepted' } : item) })} style={{ color: 'var(--cp-green)', background: ticket.review_status === 'accepted' ? 'rgba(0,255,136,0.2)' : 'transparent', border: '1px solid var(--cp-green)', fontSize: '9px', fontWeight: ticket.review_status === 'accepted' ? 700 : 400 }}>ACCEPT</button><button type="button" aria-pressed={ticket.review_status === 'rejected'} onClick={() => setReviewPlan({ ...reviewPlan, tickets: reviewPlan.tickets.map((item, itemIndex) => itemIndex === index ? { ...item, review_status: 'rejected' } : item) })} style={{ color: '#ff5f56', background: ticket.review_status === 'rejected' ? 'rgba(255,95,86,0.2)' : 'transparent', border: '1px solid #ff5f56', fontSize: '9px', fontWeight: ticket.review_status === 'rejected' ? 700 : 400 }}>REJECT</button><button type="button" onClick={() => { const replacement = decomposeEpicIntoTickets(reviewPlan.prd.epic_summary || 'the feature outcome')[index]; if (replacement) setReviewPlan({ ...reviewPlan, tickets: reviewPlan.tickets.map((item, itemIndex) => itemIndex === index ? replacement : item) }) }} style={{ color: '#f59e0b', background: 'transparent', border: '1px solid #f59e0b', fontSize: '9px' }}>REGENERATE</button></div>
                  </div>)}
                  <button type="button" disabled={!reviewPlan.tickets.some((ticket) => ticket.review_status === 'accepted') || finalizationState === 'finalizing'} onClick={() => { void handleFinalizeAcceptedStories() }} style={{ marginTop: '4px', padding: '7px 10px', border: '1px solid var(--cp-cyan)', color: 'var(--cp-cyan)', background: 'rgba(0,229,255,0.08)', fontSize: '10px', cursor: finalizationState === 'finalizing' ? 'wait' : 'pointer' }}>{finalizationState === 'finalizing' ? 'FINALIZING STORIES…' : 'FINALIZE ACCEPTED STORIES'}</button>
                </div>}
                {finalizationState === 'success' && <div role="status" aria-live="polite" style={{ marginTop: '6px', color: 'var(--cp-green)', fontSize: '10px' }}>Accepted stories finalized and added to planning.</div>}
                {finalizationState === 'error' && <div role="alert" style={{ marginTop: '6px', color: '#ff5f56', fontSize: '10px' }}>Could not finalize stories: {finalizationError}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {drawerOpen && (drawerMode === 'edit-project' || drawerMode === 'new-project') && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: '20px', pointerEvents: 'auto' }}>
          <EditDrawer
            variant="modal"
            mode={drawerMode}
            onClose={() => {
              if (drawerMode === 'edit-project' && selectedProject) {
                setDrawerMode('view-project')
                onProjectDrawerChange?.(true)
                return
              }
              setDrawerMode('closed')
              onProjectDrawerChange?.(false)
            }}
            project={selectedProject}
            feature={selectedFeature}
            prd={selectedPrd}
            squads={squads}
            activeSquadId={activeSquadId}
            activeProjectId={activeProjectId}
            onSaveProject={(p) => {
              onSaveProject(p)
              setSelection({ kind: 'project', id: p.id })
            }}
            onSaveFeature={(f) => {
              onSaveFeature(f)
              setSelection({ kind: 'feature', id: f.id, projectId: f.project_id })
            }}
            onSavePRD={(p) => {
              onSavePRD(p)
              setSelection({ kind: 'prd', id: p.id, projectId: p.project_id })
              onSelectPrd?.(p.id)
            }}
          />
        </div>
      )}
      {drawerOpen && drawerMode === 'new-feature' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: '20px', pointerEvents: 'auto' }}>
          <EditDrawer
            variant="modal"
            mode={drawerMode}
            onClose={() => {
              setDrawerMode('closed')
              onProjectDrawerChange?.(false)
            }}
            project={selectedProject}
            feature={selectedFeature}
            prd={selectedPrd}
            squads={squads}
            activeSquadId={activeSquadId}
            activeProjectId={activeProjectId}
            onSaveProject={onSaveProject}
            onSaveFeature={(f) => {
              onSaveFeature(f)
              setSelection({ kind: 'feature', id: f.id, projectId: f.project_id })
              setProjectTab('features')
            }}
            onSavePRD={(p) => {
              onSavePRD(p)
              setSelection({ kind: 'prd', id: p.id, projectId: p.project_id })
              onSelectPrd?.(p.id)
            }}
          />
        </div>
      )}
    </div>
  )
}
