import { useState } from 'react'
import { ForgeConfig } from '../services/localState'
import { SavantProfile, getStoredApiKey, setStoredApiKey } from '../services/savantClient'
import { Check, X, KeyRound, RefreshCcw, Activity, ShieldAlert } from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  config: ForgeConfig | null
  onConfigChange: (updated: ForgeConfig) => void
  onClose: () => void
  theme: string
  serverUrl: string
  gatewayUrl: string
  onServerUrlChange: (url: string) => void
  onGatewayUrlChange: (url: string) => void
  providers: Array<{ id: string; label: string; models: string[] }>
  profile: SavantProfile | null
  onProfileChange: (updated: SavantProfile | null) => void
}

export function SettingsModal({
  isOpen,
  config,
  onConfigChange,
  onClose,
  theme,
  serverUrl,
  gatewayUrl,
  onServerUrlChange,
  onGatewayUrlChange,
  providers = [],
  profile,
  onProfileChange
}: SettingsModalProps) {
  if (!isOpen) return null

  const [activeTab, setActiveTab] = useState<'operator' | 'savant' | 'gateway' | 'athena' | 'forge'>('operator')
  const [apiKey, setApiKey] = useState(() => getStoredApiKey())
  const [profileName, setProfileName] = useState(profile?.name || '')
  
  // Region & holiday local state managers
  const holidayMap = config?.company_holidays_by_region || {}
  const regions = Object.keys(holidayMap)
  const [selectedRegion, setSelectedRegion] = useState(() => regions[0] || 'NY')
  const [newRegionName, setNewRegionName] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')
  const [newHolidayDate, setNewHolidayDate] = useState('')

  // Health states
  const [savantHealth, setSavantHealth] = useState<{ status: 'online' | 'offline' | 'checking' | 'idle'; detail: string }>({ status: 'idle', detail: '' })
  const [gatewayHealthState, setGatewayHealthState] = useState<{ status: 'online' | 'offline' | 'checking' | 'idle'; detail: string }>({ status: 'idle', detail: '' })

  const hasProviders = providers.length > 0
  const selectedProvider = config?.athena_provider || providers[0]?.id || ''
  const currentProvider = providers.find((provider) => provider.id === selectedProvider) || providers[0] || null
  const currentModels = currentProvider?.models || []
  const selectedModel = config?.athena_model || currentModels[0] || ''

  const currentRegion = selectedRegion || regions[0] || 'NY'
  const currentRegionHolidays = holidayMap[currentRegion] || []

  const updateConfig = (patch: Partial<ForgeConfig>) => {
    if (!config) return
    onConfigChange({ ...config, ...patch })
  }

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((item) => item.id === providerId)
    updateConfig({
      athena_provider: providerId,
      athena_model: provider?.models[0] || ''
    })
  }

  const handleRegenerateKey = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let newKey = 'sk-'
    for (let i = 0; i < 24; i++) {
      newKey += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setStoredApiKey(newKey)
    setApiKey(newKey)
  }

  const handleProfileNameChange = (name: string) => {
    setProfileName(name)
    if (profile) {
      onProfileChange({ ...profile, name })
    } else {
      onProfileChange({ userId: 'guest-id', name, role: 'user' })
    }
  }

  const handleToggleWorkday = (day: string) => {
    if (!config) return
    const currentWorkdays = config.workdays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    const updated = currentWorkdays.includes(day)
      ? currentWorkdays.filter((d) => d !== day)
      : [...currentWorkdays, day]
    updateConfig({ workdays: updated })
  }

  const handleAddRegion = () => {
    if (!newRegionName.trim() || !config) return
    const regionKey = newRegionName.trim().toLowerCase().replace(/\s+/g, '-')
    const currentHolidays = config.company_holidays_by_region || {}
    if (currentHolidays[regionKey]) return
    
    const updated = {
      ...config,
      company_holidays_by_region: {
        ...currentHolidays,
        [regionKey]: []
      }
    }
    onConfigChange(updated)
    setSelectedRegion(regionKey)
    setNewRegionName('')
  }

  const handleAddHoliday = () => {
    if (!config || !newHolidayName.trim() || !newHolidayDate) return
    const targetRegion = currentRegion
    const currentHolidays = config.company_holidays_by_region || {}
    const regionHolidays = currentHolidays[targetRegion] || []
    
    const newHoliday = {
      id: `${targetRegion}-${Date.now()}`,
      region: targetRegion,
      name: newHolidayName.trim(),
      date: newHolidayDate
    }
    
    const updated = {
      ...config,
      company_holidays_by_region: {
        ...currentHolidays,
        [targetRegion]: [...regionHolidays, newHoliday]
      }
    }
    onConfigChange(updated)
    setNewHolidayName('')
    setNewHolidayDate('')
  }

  const handleDeleteHoliday = (holidayId: string) => {
    if (!config) return
    const targetRegion = currentRegion
    const currentHolidays = config.company_holidays_by_region || {}
    const regionHolidays = currentHolidays[targetRegion] || []
    const updatedHolidays = regionHolidays.filter(h => h.id !== holidayId)
    
    const updated = {
      ...config,
      company_holidays_by_region: {
        ...currentHolidays,
        [targetRegion]: updatedHolidays
      }
    }
    onConfigChange(updated)
  }

  const handleCheckSavantHealth = async () => {
    setSavantHealth({ status: 'checking', detail: 'Connecting to health/ready...' })
    try {
      const cleanUrl = serverUrl.replace(/\/+$/, '')
      const res = await fetch(`${cleanUrl}/health/ready`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        setSavantHealth({ status: 'online', detail: 'Server is up (health/ready OK)' })
      } else {
        setSavantHealth({ status: 'offline', detail: `Server responded with status ${res.status}` })
      }
    } catch (err: any) {
      setSavantHealth({ status: 'offline', detail: err.message || 'Connection failed' })
    }
  }

  const handleCheckGatewayHealth = async () => {
    setGatewayHealthState({ status: 'checking', detail: 'Connecting to /health...' })
    try {
      const cleanUrl = gatewayUrl.replace(/\/+$/, '')
      const res = await fetch(`${cleanUrl}/health`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        setGatewayHealthState({ status: 'online', detail: 'Gateway is up (/health OK)' })
      } else {
        setGatewayHealthState({ status: 'offline', detail: `Gateway responded with status ${res.status}` })
      }
    } catch (err: any) {
      setGatewayHealthState({ status: 'offline', detail: err.message || 'Connection failed' })
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="settings-backdrop">
      <style>{`
        @keyframes settings-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .settings-animate-spin {
          animation: settings-spin 1s linear infinite;
        }
      `}</style>
      <div 
        className="modal-card flex flex-col gap-4" 
        style={{ maxWidth: '760px', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head border-b border-[var(--cp-border)] pb-3" style={{ borderBottom: '1px solid var(--cp-border)', paddingBottom: '8px', marginBottom: '12px' }}>
          <div>
            <div className="eyebrow">System Preferences</div>
            <h2 style={{ margin: 0, fontSize: '14px', color: 'var(--cp-cyan)', fontFamily: "'Orbitron', sans-serif" }} className="tracking-widest uppercase">
              FORGE SETTINGS
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="ghost-btn action-close icon-only"
            aria-label="Close"
            title="Close"
            style={{ background: 'transparent', border: '1px solid rgba(255, 0, 170, 0.35)', color: 'var(--cp-magenta)', cursor: 'pointer', width: '28px', height: '28px', display: 'grid', placeItems: 'center' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--cp-border)', paddingBottom: '0px', gap: '4px' }}>
          {(['operator', 'savant', 'gateway', 'athena', 'forge'] as const).map((tab) => {
            const isActive = activeTab === tab
            let tabLabel = tab.toUpperCase()
            if (tab === 'savant') tabLabel = 'SAVANT'
            else if (tab === 'athena') tabLabel = 'ATHENA'
            else if (tab === 'forge') tabLabel = 'FORGE'
            
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: isActive ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--cp-cyan)' : '2px solid transparent',
                  color: isActive ? 'var(--cp-cyan)' : 'var(--foreground)',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '11px',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em',
                  opacity: isActive ? 1 : 0.55,
                  transition: 'all 0.15s ease-in-out',
                  outline: 'none'
                }}
              >
                {tabLabel}
              </button>
            )
          })}
        </div>

        {/* Tab Contents Panel Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '320px', justifyContent: 'flex-start' }}>
          
          {/* TAB 1: Operator */}
          <div 
            style={{ 
              display: activeTab === 'operator' ? 'flex' : 'none', 
              flexDirection: 'column', 
              gap: '14px',
              background: 'var(--cp-bg-2)', 
              border: '1px solid var(--cp-border)', 
              padding: '16px' 
            }}
          >
            <div style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)', fontSize: '11px' }}>
              Operator Identification & Key Registry
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--foreground)', opacity: 0.75 }}>Operator User Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => handleProfileNameChange(e.target.value)}
                style={{ 
                  background: 'var(--cp-bg-3)', 
                  border: '1px solid var(--cp-border)', 
                  color: 'var(--foreground)', 
                  padding: '8px 10px', 
                  outline: 'none', 
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '12px'
                }}
                placeholder="Enter operator name..."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--foreground)', opacity: 0.75 }}>Operator API Key</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ 
                  flex: 1, 
                  background: 'var(--cp-bg-3)', 
                  border: '1px solid var(--cp-border)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '8px 10px' 
                }}>
                  <KeyRound size={14} style={{ color: 'var(--cp-cyan)', opacity: 0.7 }} />
                  <input
                    type="password"
                    value={apiKey}
                    readOnly
                    style={{
                      background: 'transparent',
                      color: 'var(--foreground)',
                      fontFamily: "'Share Tech Mono', monospace",
                      outline: 'none',
                      border: 'none',
                      width: '100%',
                      fontSize: '12px'
                    }}
                    placeholder="No API key generated"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  style={{
                    background: 'rgba(0, 229, 255, 0.08)',
                    border: '1px solid rgba(0, 229, 255, 0.35)',
                    color: 'var(--cp-cyan)',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 229, 255, 0.16)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 229, 255, 0.08)'
                  }}
                >
                  Regenerate Key
                </button>
              </div>
            </div>
          </div>

          {/* TAB 2: Savant Server */}
          <div 
            style={{ 
              display: activeTab === 'savant' ? 'flex' : 'none', 
              flexDirection: 'column', 
              gap: '14px',
              background: 'var(--cp-bg-2)', 
              border: '1px solid var(--cp-border)', 
              padding: '16px' 
            }}
          >
            <div style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)', fontSize: '11px' }}>
              Savant Central Registry Service Config
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--foreground)', opacity: 0.75 }}>Savant Server URL</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => onServerUrlChange(e.target.value)}
                  style={{ 
                    flex: 1,
                    background: 'var(--cp-bg-3)', 
                    border: '1px solid var(--cp-border)', 
                    color: 'var(--foreground)', 
                    padding: '8px 10px', 
                    outline: 'none', 
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '12px'
                  }}
                  placeholder="e.g. http://127.0.0.1:8090"
                />
                <button
                  type="button"
                  onClick={handleCheckSavantHealth}
                  style={{
                    background: 'rgba(0, 229, 255, 0.08)',
                    border: '1px solid rgba(0, 229, 255, 0.35)',
                    color: 'var(--cp-cyan)',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 229, 255, 0.16)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 229, 255, 0.08)'
                  }}
                >
                  <Activity size={12} className={savantHealth.status === 'checking' ? 'settings-animate-spin' : ''} />
                  Check Health
                </button>
              </div>
            </div>

            {/* Health Result */}
            {savantHealth.status !== 'idle' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '8px 10px', 
                border: '1px solid ' + (savantHealth.status === 'online' ? 'rgba(0, 255, 136, 0.3)' : savantHealth.status === 'checking' ? 'rgba(255, 170, 0, 0.3)' : 'rgba(255, 0, 100, 0.3)'),
                background: savantHealth.status === 'online' ? 'rgba(0, 255, 136, 0.04)' : savantHealth.status === 'checking' ? 'rgba(255, 170, 0, 0.04)' : 'rgba(255, 0, 100, 0.04)',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '11px'
              }}>
                {savantHealth.status === 'online' ? (
                  <Check size={12} style={{ color: 'var(--cp-green)' }} />
                ) : savantHealth.status === 'checking' ? (
                  <RefreshCcw size={12} style={{ color: 'var(--cp-yellow)' }} className="settings-animate-spin" />
                ) : (
                  <ShieldAlert size={12} style={{ color: 'var(--cp-magenta)' }} />
                )}
                <span style={{ 
                  color: savantHealth.status === 'online' ? 'var(--cp-green)' : savantHealth.status === 'checking' ? 'var(--cp-yellow)' : 'var(--cp-magenta)',
                  fontWeight: 'bold'
                }}>
                  {savantHealth.status.toUpperCase()}:
                </span>
                <span style={{ color: 'var(--foreground)' }}>
                  {savantHealth.detail}
                </span>
              </div>
            )}
          </div>

          {/* TAB 3: Gateway */}
          <div 
            style={{ 
              display: activeTab === 'gateway' ? 'flex' : 'none', 
              flexDirection: 'column', 
              gap: '14px',
              background: 'var(--cp-bg-2)', 
              border: '1px solid var(--cp-border)', 
              padding: '16px' 
            }}
          >
            <div style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)', fontSize: '11px' }}>
              Gateway Communication Routing
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--foreground)', opacity: 0.75 }}>Gateway URL</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={gatewayUrl}
                  onChange={(e) => onGatewayUrlChange(e.target.value)}
                  style={{ 
                    flex: 1,
                    background: 'var(--cp-bg-3)', 
                    border: '1px solid var(--cp-border)', 
                    color: 'var(--foreground)', 
                    padding: '8px 10px', 
                    outline: 'none', 
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '12px'
                  }}
                  placeholder="e.g. http://127.0.0.1:3100"
                />
                <button
                  type="button"
                  onClick={handleCheckGatewayHealth}
                  style={{
                    background: 'rgba(0, 229, 255, 0.08)',
                    border: '1px solid rgba(0, 229, 255, 0.35)',
                    color: 'var(--cp-cyan)',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 229, 255, 0.16)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 229, 255, 0.08)'
                  }}
                >
                  <Activity size={12} className={gatewayHealthState.status === 'checking' ? 'settings-animate-spin' : ''} />
                  Check Health
                </button>
              </div>
            </div>

            {/* Health Result */}
            {gatewayHealthState.status !== 'idle' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '8px 10px', 
                border: '1px solid ' + (gatewayHealthState.status === 'online' ? 'rgba(0, 255, 136, 0.3)' : gatewayHealthState.status === 'checking' ? 'rgba(255, 170, 0, 0.3)' : 'rgba(255, 0, 100, 0.3)'),
                background: gatewayHealthState.status === 'online' ? 'rgba(0, 255, 136, 0.04)' : gatewayHealthState.status === 'checking' ? 'rgba(255, 170, 0, 0.04)' : 'rgba(255, 0, 100, 0.04)',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '11px'
              }}>
                {gatewayHealthState.status === 'online' ? (
                  <Check size={12} style={{ color: 'var(--cp-green)' }} />
                ) : gatewayHealthState.status === 'checking' ? (
                  <RefreshCcw size={12} style={{ color: 'var(--cp-yellow)' }} className="settings-animate-spin" />
                ) : (
                  <ShieldAlert size={12} style={{ color: 'var(--cp-magenta)' }} />
                )}
                <span style={{ 
                  color: gatewayHealthState.status === 'online' ? 'var(--cp-green)' : gatewayHealthState.status === 'checking' ? 'var(--cp-yellow)' : 'var(--cp-magenta)',
                  fontWeight: 'bold'
                }}>
                  {gatewayHealthState.status.toUpperCase()}:
                </span>
                <span style={{ color: 'var(--foreground)' }}>
                  {gatewayHealthState.detail}
                </span>
              </div>
            )}

          </div>

          {/* TAB 4: Athena */}
          <div 
            style={{ 
              display: activeTab === 'athena' ? 'flex' : 'none', 
              flexDirection: 'column', 
              gap: '14px',
              background: 'var(--cp-bg-2)', 
              border: '1px solid var(--cp-border)', 
              padding: '16px' 
            }}
          >
            <div style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)', fontSize: '11px' }}>
              Athena Copilot Service Engine
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--foreground)', opacity: 0.75 }}>Athena Provider</span>
              {hasProviders ? (
                <select
                  value={selectedProvider}
                  onChange={(event) => handleProviderChange(event.target.value)}
                  style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--foreground)', padding: '8px 10px', outline: 'none', fontFamily: "'Share Tech Mono', monospace" }}
                  data-testid="athena-provider-select"
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id} style={{ background: '#080b12', color: '#fff' }}>
                      {provider.label} Provider
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ border: '1px dashed rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', fontSize: '11px', padding: '8px 10px', fontFamily: "'Share Tech Mono', monospace" }}>
                  GATEWAY ERROR: NO PROVIDERS DETECTED
                </div>
              )}
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--foreground)', opacity: 0.75 }}>Athena Model</span>
              {hasProviders ? (
                <select
                  value={selectedModel}
                  onChange={(event) => updateConfig({ athena_model: event.target.value })}
                  style={{ background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', color: 'var(--foreground)', padding: '8px 10px', outline: 'none', fontFamily: "'Share Tech Mono', monospace" }}
                  data-testid="athena-model-select"
                >
                  {currentModels.map((model) => (
                    <option key={model} value={model} style={{ background: '#080b12', color: '#fff' }}>
                      {model} Model
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ border: '1px dashed rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', fontSize: '11px', padding: '8px 10px', fontFamily: "'Share Tech Mono', monospace" }}>
                  GATEWAY ERROR: NO MODELS DETECTED
                </div>
              )}
            </label>

            {/* Gateway Providers / Models inventory list (hidden from user, preserved in DOM for test suite) */}
            <div style={{ display: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--cp-border)', paddingBottom: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>
                  Gateway Providers
                </span>
                <span style={{ fontSize: '9px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                  Active: {selectedProvider || 'none'}
                </span>
              </div>

              {hasProviders ? (
                <div style={{ display: 'grid', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                  {providers.map((provider) => {
                    const isSelected = provider.id === selectedProvider
                    return (
                      <div
                        key={provider.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          border: isSelected ? '1px solid var(--cp-cyan)' : '1px solid var(--cp-border)',
                          background: isSelected ? 'rgba(0, 229, 255, 0.04)' : 'var(--cp-bg-2)',
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: '11px',
                          color: isSelected ? 'var(--foreground)' : 'var(--muted-foreground)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleProviderChange(provider.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: isSelected ? 'var(--cp-cyan)' : 'var(--muted-foreground)',
                              cursor: 'pointer',
                              padding: 0,
                              fontFamily: "'Share Tech Mono', monospace",
                              fontWeight: 'bold',
                              fontSize: '11px'
                            }}
                          >
                            {isSelected ? '[x]' : '[ ]'}
                          </button>
                          
                          <span style={{ fontWeight: 'bold', color: isSelected ? 'var(--foreground)' : 'var(--muted-foreground)', minWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {provider.label}
                          </span>

                          <span style={{ color: 'var(--muted-foreground)', fontSize: '10px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '6px' }}>
                            ({provider.models.map((model, idx) => (
                              <span key={model}>
                                {idx > 0 ? ', ' : ''}
                                <span>{model}</span>
                              </span>
                            ))})
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleProviderChange(provider.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid ' + (isSelected ? 'rgba(0, 229, 255, 0.3)' : 'var(--cp-border)'),
                            color: isSelected ? 'var(--cp-cyan)' : 'var(--muted-foreground)',
                            cursor: 'pointer',
                            padding: '1px 6px',
                            fontSize: '9px',
                            fontFamily: "'Share Tech Mono', monospace"
                          }}
                        >
                          {isSelected ? 'Reconfigure' : 'Detect'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ border: '1px dashed rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', fontSize: '11px', padding: '8px 10px', fontFamily: "'Share Tech Mono', monospace" }}>
                  GATEWAY ERROR: NO PROVIDERS DETECTED
                </div>
              )}
            </div>
          </div>

          {/* TAB 5: Forge settings */}
          <div 
            style={{ 
              display: activeTab === 'forge' ? 'flex' : 'none', 
              flexDirection: 'column', 
              gap: '14px',
              background: 'var(--cp-bg-2)', 
              border: '1px solid var(--cp-border)', 
              padding: '16px' 
            }}
          >
            <div style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--section-label)', fontSize: '11px' }}>
              Forge Engine Core Controls
            </div>

            {/* Buffer threshold */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--foreground)', opacity: 0.75 }}>Safety Buffer Capacity Threshold</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input 
                  type="range" 
                  min="50" 
                  max="100" 
                  value={(config?.buffer_threshold || 0.8) * 100}
                  onChange={(e) => {
                    if (config) {
                      const updated = { ...config, buffer_threshold: parseInt(e.target.value) / 100 }
                      onConfigChange(updated)
                    }
                  }}
                  style={{ flex: 1 }}
                  data-testid="buffer-threshold-input"
                />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--cp-green)', fontSize: '14px', fontWeight: 'bold' }}>
                  {((config?.buffer_threshold || 0.8) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Workdays */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--cp-border)', paddingTop: '10px' }}>
              <label style={{ fontSize: '11px', color: 'var(--foreground)', opacity: 0.75 }}>Global Workdays</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                  const isWorkday = (config?.workdays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']).includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleWorkday(day)}
                      style={{
                        background: isWorkday ? 'rgba(0, 255, 136, 0.08)' : 'var(--cp-bg-3)',
                        border: isWorkday ? '1px solid var(--cp-green)' : '1px solid var(--cp-border)',
                        color: isWorkday ? 'var(--cp-green)' : 'var(--muted-foreground)',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '10px',
                        fontWeight: 'bold',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {day.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Region / Holidays editor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--cp-border)', paddingTop: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--foreground)', opacity: 0.75 }}>Regions & Region Holidays</span>
              
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
                {/* Active Regions list selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '1px solid var(--cp-border)', paddingRight: '8px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
                    Active Regions
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '110px', overflowY: 'auto' }}>
                    {(regions.length > 0 ? regions : ['NY', 'lisbon']).map((region) => {
                      const isActive = currentRegion === region
                      return (
                        <button
                          key={region}
                          type="button"
                          onClick={() => setSelectedRegion(region)}
                          style={{
                            background: isActive ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                            border: 'none',
                            color: isActive ? 'var(--cp-cyan)' : 'var(--muted-foreground)',
                            padding: '4px 6px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: '11px',
                            fontWeight: isActive ? 'bold' : 'normal',
                            borderLeft: isActive ? '2px solid var(--cp-cyan)' : '2px solid transparent'
                          }}
                        >
                          {region.toUpperCase()}
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed var(--cp-border)', paddingTop: '6px' }}>
                    <input
                      type="text"
                      placeholder="new-region"
                      value={newRegionName}
                      onChange={(e) => setNewRegionName(e.target.value)}
                      style={{
                        background: 'var(--cp-bg-3)',
                        border: '1px solid var(--cp-border)',
                        color: 'var(--foreground)',
                        padding: '3px 4px',
                        outline: 'none',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '10px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddRegion}
                      style={{
                        background: 'rgba(0, 229, 255, 0.06)',
                        border: '1px solid rgba(0, 229, 255, 0.25)',
                        color: 'var(--cp-cyan)',
                        padding: '3px 6px',
                        cursor: 'pointer',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '9px',
                        fontWeight: 'bold'
                      }}
                    >
                      + ADD REGION
                    </button>
                  </div>
                </div>

                {/* Holiday list and forms */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace" }}>
                    Holidays in {currentRegion.toUpperCase()}
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '110px', overflowY: 'auto', background: 'var(--cp-bg-3)', padding: '4px', border: '1px solid var(--cp-border)' }}>
                    {currentRegionHolidays.length > 0 ? (
                      currentRegionHolidays.map((holiday) => (
                        <div
                          key={holiday.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '3px 6px',
                            background: 'var(--cp-bg-2)',
                            border: '1px solid var(--cp-border)',
                            fontSize: '11px',
                            fontFamily: "'Share Tech Mono', monospace"
                          }}
                        >
                          <div>
                            <span style={{ color: 'var(--foreground)', fontWeight: 'bold' }}>{holiday.name}</span>
                            <span style={{ color: 'var(--cp-yellow)', marginLeft: '8px' }}>{holiday.date}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteHoliday(holiday.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--cp-magenta)',
                              cursor: 'pointer',
                              padding: '1px 3px',
                              fontSize: '10px'
                            }}
                          >
                            delete
                          </button>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--muted-foreground)', fontSize: '10px', textAlign: 'center', padding: '8px', fontStyle: 'italic' }}>
                        No holidays registered for region.
                      </div>
                    )}
                  </div>

                  {/* Add holiday row form */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '4px' }}>
                    <input
                      type="text"
                      placeholder="Holiday Name"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                      style={{
                        flex: 1.5,
                        background: 'var(--cp-bg-3)',
                        border: '1px solid var(--cp-border)',
                        color: 'var(--foreground)',
                        padding: '4px 6px',
                        outline: 'none',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '10px'
                      }}
                    />
                    <input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }}
                      style={{
                        flex: 1.2,
                        background: 'var(--cp-bg-3)',
                        border: '1px solid var(--cp-border)',
                        color: 'var(--foreground)',
                        padding: '3px 6px',
                        outline: 'none',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '10px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddHoliday}
                      style={{
                        background: 'rgba(0, 255, 136, 0.08)',
                        border: '1px solid rgba(0, 255, 136, 0.35)',
                        color: 'var(--cp-green)',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}
                    >
                      + ADD
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Environment Status (Always rendered at the bottom for tests compatibility) */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', borderTop: '1px dashed var(--cp-border)', paddingTop: '10px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--foreground)', opacity: 0.5 }}>Environment</span>
            <strong style={{ color: 'var(--cp-yellow)', fontFamily: "'Share Tech Mono', monospace" }}>{theme.toUpperCase()}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--foreground)', opacity: 0.5 }}>Server URL</span>
            <strong style={{ color: 'var(--foreground)', fontFamily: "'Share Tech Mono', monospace" }}>{serverUrl}</strong>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--foreground)', opacity: 0.5 }}>Gateway Link</span>
            <strong style={{ color: 'var(--foreground)', fontFamily: "'Share Tech Mono', monospace" }}>{gatewayUrl}</strong>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--cp-border)' }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: 'var(--foreground)', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {hasProviders ? 'Gateway providers loaded' : 'Gateway provider discovery failed'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '9px',
              color: 'var(--cp-green)',
              fontFamily: "'Share Tech Mono', monospace",
              border: '1px solid rgba(0, 255, 136, 0.3)',
              background: 'rgba(0, 255, 136, 0.05)',
              padding: '4px 8px',
              fontWeight: 'bold',
              letterSpacing: '0.05em'
            }}>
              AUTO-SAVE ACTIVE
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              title="Close"
              style={{ background: 'transparent', border: '1px solid rgba(255, 0, 170, 0.35)', color: 'var(--cp-magenta)', width: '28px', height: '28px', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
