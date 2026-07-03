import { useState, FormEvent, useEffect } from 'react'
import { X } from 'lucide-react'
import { JiraTicket } from '../services/localState'

interface AddTicketModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (draft: { ticket_key: string; title: string; story_points: number; priority: string }) => void
  onUpdate?: (ticketId: string, draft: { ticket_key: string; title: string; story_points: number; priority: string }) => void
  ticket?: JiraTicket | null
}

export function AddTicketModal({ isOpen, onClose, onCreate, onUpdate, ticket }: AddTicketModalProps) {
  const [ticketKey, setTicketKey] = useState('')
  const [title, setTitle] = useState('')
  const [storyPoints, setStoryPoints] = useState(5)
  const [priority, setPriority] = useState('medium')

  useEffect(() => {
    if (isOpen) {
      if (ticket) {
        setTicketKey(ticket.ticket_key)
        setTitle(ticket.title.replace(/\[SP-\d+\]\s*/i, ''))
        setStoryPoints(ticket.story_points || 5)
        setPriority(ticket.priority || 'medium')
      } else {
        // Auto-generate a ticket key
        const rand = Math.floor(100 + Math.random() * 900)
        setTicketKey(`JIRA-${rand}`)
        setTitle('')
        setStoryPoints(5)
        setPriority('medium')
      }
    }
  }, [isOpen, ticket])

  if (!isOpen) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ticketKey.trim() || !title.trim()) return
    
    const draft = {
      ticket_key: ticketKey.trim(),
      title: title.trim(),
      story_points: storyPoints,
      priority
    }

    if (ticket && onUpdate) {
      onUpdate(ticket.ticket_id, draft)
    } else {
      onCreate(draft)
    }
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="add-ticket-modal-backdrop">
      <div 
        className="modal-card" 
        style={{ 
          maxWidth: '420px', 
          position: 'relative', 
          background: 'var(--cp-bg-2)', 
          border: '1px solid var(--cp-cyan)',
          boxShadow: 'var(--cp-glow-cyan)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            padding: '4px'
          }}
          title="Close dialog"
        >
          <X size={16} />
        </button>

        <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--cp-cyan)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em' }}>
          {ticket ? 'EDIT JIRA TICKET' : 'CREATE JIRA TICKET'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>TICKET KEY</span>
            <input 
              type="text" 
              value={ticketKey}
              onChange={e => setTicketKey(e.target.value)}
              placeholder="e.g. JIRA-120"
              required
              style={{
                background: 'var(--cp-bg-3)',
                border: '1px solid var(--cp-border)',
                color: 'var(--foreground)',
                fontSize: '12px',
                fontFamily: "'Share Tech Mono', monospace",
                padding: '6px 8px',
                outline: 'none'
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>TICKET TITLE</span>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Build API integration"
              required
              style={{
                background: 'var(--cp-bg-3)',
                border: '1px solid var(--cp-border)',
                color: 'var(--foreground)',
                fontSize: '12px',
                padding: '6px 8px',
                outline: 'none'
              }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>STORY POINTS</span>
              <select
                value={storyPoints}
                onChange={e => setStoryPoints(parseInt(e.target.value))}
                style={{
                  background: 'var(--cp-bg-3)',
                  border: '1px solid var(--cp-border)',
                  color: 'var(--foreground)',
                  fontSize: '12px',
                  fontFamily: "'Share Tech Mono', monospace",
                  padding: '6px',
                  outline: 'none'
                }}
              >
                <option value="1">1 SP</option>
                <option value="2">2 SP</option>
                <option value="3">3 SP</option>
                <option value="5">5 SP</option>
                <option value="8">8 SP</option>
                <option value="13">13 SP</option>
                <option value="21">21 SP</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>PRIORITY</span>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={{
                  background: 'var(--cp-bg-3)',
                  border: '1px solid var(--cp-border)',
                  color: 'var(--foreground)',
                  fontSize: '12px',
                  fontFamily: "'Share Tech Mono', monospace",
                  padding: '6px',
                  outline: 'none'
                }}
              >
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'flex-end' }}>
            <button 
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--cp-bg-3)',
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
            <button 
              type="submit"
              style={{
                background: 'var(--cp-cyan)',
                color: 'var(--cp-bg-0)',
                border: 0,
                fontSize: '11px',
                fontFamily: "'Share Tech Mono', monospace",
                fontWeight: 'bold',
                padding: '8px 16px',
                cursor: 'pointer'
              }}
            >
              {ticket ? 'SAVE CHANGES' : 'CREATE TICKET'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
