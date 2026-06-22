interface LogoutConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function LogoutConfirmModal({
  isOpen,
  onConfirm,
  onCancel
}: LogoutConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onCancel} data-testid="logout-backdrop">
      <div 
        className="modal-card flex flex-col gap-4 text-center" 
        style={{ maxWidth: '360px', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--cp-magenta)', fontFamily: "'Orbitron', sans-serif" }} className="tracking-widest uppercase">
          TERMINATE SESSION?
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontFamily: "'Rajdhani', sans-serif" }}>
          Are you sure you want to log out of Savant Forge? This will clear active registries.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'center' }}>
          <button 
            onClick={onConfirm}
            style={{
              background: 'var(--cp-magenta)',
              color: '#fff',
              border: 0,
              fontSize: '11px',
              fontFamily: "'Share Tech Mono', monospace",
              fontWeight: 'bold',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            LOG OUT
          </button>
          <button 
            onClick={onCancel}
            style={{
              background: 'var(--cp-bg-2)',
              color: 'var(--foreground)',
              border: '1px solid var(--cp-border)',
              fontSize: '11px',
              fontFamily: "'Share Tech Mono', monospace",
              fontWeight: 'bold',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
