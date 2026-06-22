import { Users, Layers, Sliders, Power, FileText } from 'lucide-react'

interface LeftRailProps {
  activeTab: 'squad' | 'projects' | 'blueprint' | 'settings'
  isLeftPaneOpen: boolean
  isSettingsOpen: boolean
  isLogoutConfirmOpen: boolean
  onSelectTab: (tab: 'squad' | 'projects' | 'blueprint') => void
  onToggleLeftPane: () => void
  onOpenSettings: () => void
  onOpenLogoutConfirm: () => void
}

export function LeftRail({
  activeTab,
  isLeftPaneOpen,
  isSettingsOpen,
  isLogoutConfirmOpen,
  onSelectTab,
  onToggleLeftPane,
  onOpenSettings,
  onOpenLogoutConfirm
}: LeftRailProps) {
  return (
    <aside className="icon-rail" style={{ background: 'var(--cp-bg-1)', borderRight: '1px solid var(--cp-border)' }} data-testid="left-rail">
      <div className="rail-top">
        {/* 1. SQUAD (Users icon) */}
        <button 
          className={`nav-icon ${activeTab === 'squad' ? 'active' : ''}`}
          onClick={() => onSelectTab('squad')}
          title="squad"
          data-testid="tab-squad"
        >
          <Users size={16} />
          <span className="rail-label-text">squad</span>
        </button>

        {/* 2. PROJECTS (Folder/Layers icon for product epics & blueprints) */}
        <button 
          className={`nav-icon ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => onSelectTab('projects')}
          title="projects"
          data-testid="tab-projects"
        >
          <FileText size={16} />
          <span className="rail-label-text">projects</span>
        </button>

        {/* 3. BLUEPRINT (Backlog/Ingest list view) */}
        <button 
          className={`nav-icon ${activeTab === 'blueprint' ? 'active' : ''}`}
          onClick={() => onSelectTab('blueprint')}
          title="blueprints"
          data-testid="tab-blueprint"
        >
          <Layers size={16} />
          <span className="rail-label-text">blueprints</span>
        </button>
      </div>
      
      <div className="rail-bottom">
        <button 
          className="nav-icon"
          onClick={onToggleLeftPane}
          title={isLeftPaneOpen ? "Collapse Left Panel" : "Expand Left Panel"}
          style={{ marginBottom: '8px' }}
          data-testid="toggle-left-pane"
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
          onClick={onOpenSettings}
          title="settings"
          data-testid="btn-settings"
        >
          <Sliders size={16} />
          <span className="rail-label-text">settings</span>
        </button>
        <button 
          className={`nav-icon logout-icon ${isLogoutConfirmOpen ? 'active' : ''}`} 
          onClick={onOpenLogoutConfirm} 
          title="Logout"
          data-testid="btn-logout"
        >
          <Power size={16} />
        </button>
      </div>
    </aside>
  )
}
