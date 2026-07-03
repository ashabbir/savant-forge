import { useMemo, useEffect } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import type { SpecialtyTag, Squad } from '../services/localState'

export type DeveloperDraft = {
  id?: string
  squad_id: string
  name: string
  specialty: string
  specialty_tags: SpecialtyTag[]
  ranking: string
  raw_capacity: number
  region: string
  timezone: string
  working_days: string[]
}

type DeveloperModalProps = {
  isOpen: boolean
  mode: 'add' | 'edit'
  draft: DeveloperDraft
  onChange: (draft: DeveloperDraft) => void
  onSubmit: () => void
  onClose: () => void
  activeSquadName?: string
  squadOptions: Array<Pick<Squad, 'id' | 'name'>>
  regions?: string[]
}

const SCORE_OPTIONS: Array<SpecialtyTag['score']> = ['low', 'medium', 'high']

export function DeveloperModal({
  isOpen,
  mode,
  draft,
  onChange,
  onSubmit,
  onClose,
  activeSquadName,
  squadOptions,
  regions = []
}: DeveloperModalProps) {
  const title = mode === 'edit' ? 'EDIT PERSON' : 'ADD PERSON'
  const submitLabel = mode === 'edit' ? 'SAVE CHANGES' : 'ADD PERSON'

  const regionOptions = useMemo(() => {
    return regions && regions.length > 0 ? regions : ['NY', 'lisbon']
  }, [regions])

  useEffect(() => {
    if (isOpen) {
      if (!draft.region || !regionOptions.includes(draft.region)) {
        onChange({ ...draft, region: regionOptions[0] })
      }
    }
  }, [isOpen, regionOptions, draft.region])

  if (!isOpen) return null

  function patch(patchValue: Partial<DeveloperDraft>) {
    onChange({ ...draft, ...patchValue })
  }

  function updateTag(index: number, patchValue: Partial<SpecialtyTag>) {
    const next = draft.specialty_tags.map((tag, tagIndex) => tagIndex === index ? { ...tag, ...patchValue } : tag)
    onChange({ ...draft, specialty_tags: next })
  }

  function addTag() {
    onChange({
      ...draft,
      specialty_tags: [...draft.specialty_tags, { label: '', score: 'medium' }]
    })
  }

  function removeTag(index: number) {
    const next = draft.specialty_tags.filter((_, tagIndex) => tagIndex !== index)
    onChange({ ...draft, specialty_tags: next })
  }

  function togglePredefinedTag(label: string, score: SpecialtyTag['score'] = 'medium') {
    const exists = draft.specialty_tags.some(t => t.label.toLowerCase() === label.toLowerCase())
    if (exists) {
      const next = draft.specialty_tags.filter(t => t.label.toLowerCase() !== label.toLowerCase())
      onChange({ ...draft, specialty_tags: next })
    } else {
      onChange({
        ...draft,
        specialty_tags: [...draft.specialty_tags, { label, score }]
      })
    }
  }

  const isTagSelected = (label: string) => draft.specialty_tags.some(t => t.label.toLowerCase() === label.toLowerCase())

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="developer-modal-backdrop">
      <div
        className="modal-card flex flex-col gap-4"
        style={{ maxWidth: '920px', position: 'relative' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head border-b border-[var(--cp-border)] pb-3" style={{ borderBottom: '1px solid var(--cp-border)', paddingBottom: '8px', marginBottom: '12px' }}>
          <div>
            <div className="eyebrow">{mode === 'edit' ? 'People Editor' : 'People Intake'}</div>
            <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--cp-cyan)', fontFamily: "'Orbitron', sans-serif" }} className="tracking-widest uppercase">
              {title}
            </h2>
            <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
              {activeSquadName ? `ACTIVE SQUAD: ${activeSquadName.toUpperCase()}` : 'ACTIVE SQUAD'}
            </div>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: '12px' }}>
          <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '14px', display: 'grid', gap: '10px' }}>
            <SelectField
              label="Squad"
              value={draft.squad_id}
              onChange={(value) => patch({ squad_id: value })}
              options={squadOptions}
            />
            <TextField label="Name" value={draft.name} onChange={(value) => patch({ name: value })} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              <RegionSelectField
                label="Region"
                value={draft.region}
                onChange={(value) => patch({ region: value })}
                options={regionOptions}
              />
              <TextField label="Level" value={draft.ranking} onChange={(value) => patch({ ranking: value })} />
            </div>
            <TextField
              label="Raw Capacity"
              value={String(draft.raw_capacity)}
              onChange={(value) => patch({ raw_capacity: Number(value) || 0 })}
              type="number"
            />
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '14px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '10px', color: 'var(--section-label)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>
                  Specialties
                </div>
                <button
                  type="button"
                  onClick={addTag}
                  title="Add specialty"
                  aria-label="Add specialty"
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

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {draft.specialty_tags.map((tag, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid var(--cp-border)',
                      background: 'var(--cp-bg-3)',
                      padding: '4px 8px',
                      borderRadius: '2px',
                    }}
                  >
                    <input
                      value={tag.label}
                      placeholder="backend/rails"
                      onChange={(event) => updateTag(index, { label: event.target.value })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--foreground)',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '11px',
                        outline: 'none',
                        width: '110px'
                      }}
                    />
                    <select
                      value={tag.score}
                      onChange={(event) => updateTag(index, { score: event.target.value as SpecialtyTag['score'] })}
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(0, 229, 255, 0.3)',
                        color: tag.score === 'high' ? 'var(--cp-green)' : tag.score === 'low' ? 'var(--cp-yellow)' : 'var(--cp-cyan)',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '10px',
                        outline: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: '2px'
                      }}
                    >
                      {SCORE_OPTIONS.map((score) => (
                        <option key={score} value={score}>
                          {score.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeTag(index)}
                      title="Remove specialty"
                      aria-label="Remove specialty"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--cp-magenta)',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 0
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => togglePredefinedTag('backend/rails', 'medium')}
                  style={isTagSelected('backend/rails') ? activeTagButtonStyle : ghostButtonStyle}
                >
                  BACKEND / RAILS
                </button>
                <button
                  type="button"
                  onClick={() => togglePredefinedTag('frontend/react', 'low')}
                  style={isTagSelected('frontend/react') ? activeTagButtonStyle : ghostButtonStyle}
                >
                  FRONTEND / REACT
                </button>
                <button
                  type="button"
                  onClick={() => togglePredefinedTag('cloud infra', 'high')}
                  style={isTagSelected('cloud infra') ? activeTagButtonStyle : ghostButtonStyle}
                >
                  CLOUD INFRA
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--cp-border)' }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {mode === 'edit' ? 'Updating existing person record' : 'Creating a new person record'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              aria-label="Close"
              title="Close"
              style={{ background: 'transparent', border: '1px solid rgba(255, 0, 170, 0.35)', color: 'var(--cp-magenta)', width: '28px', height: '28px', display: 'grid', placeItems: 'center' }}
            >
              <X size={14} />
            </button>
            <button
              onClick={onSubmit}
              aria-label={submitLabel}
              title={submitLabel}
              style={{ background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.35)', color: 'var(--cp-green)', width: '28px', height: '28px', display: 'grid', placeItems: 'center' }}
            >
              <Check size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text'
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label style={{ display: 'grid', gap: '4px' }}>
      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>
        {label}
      </span>
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  )
}

function RegionSelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <label style={{ display: 'grid', gap: '4px' }}>
      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>
        {label}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<Pick<Squad, 'id' | 'name'>>
}) {
  return (
    <label style={{ display: 'grid', gap: '4px' }}>
      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>
        {label}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}

const inputStyle = {
  width: '100%',
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-3)',
  color: 'var(--foreground)',
  padding: '8px 9px',
  fontSize: '12px',
  outline: 'none'
}

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer'
}

const iconButtonStyle = {
  width: '28px',
  height: '28px',
  display: 'grid',
  placeItems: 'center',
  border: '1px solid rgba(255, 34, 68, 0.35)',
  background: 'rgba(255, 34, 68, 0.06)',
  color: 'var(--cp-magenta)',
  cursor: 'pointer'
}

const ghostButtonStyle = {
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-bg-3)',
  color: 'var(--cp-cyan)',
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '10px',
  padding: '8px 10px',
  cursor: 'pointer'
}

const activeTagButtonStyle = {
  ...ghostButtonStyle,
  background: 'rgba(0, 229, 255, 0.15)',
  borderColor: 'var(--cp-cyan)',
  color: 'var(--foreground)'
}

const ghostDangerButtonStyle = {
  border: '1px solid rgba(255, 34, 68, 0.35)',
  background: 'rgba(255, 34, 68, 0.06)',
  color: 'var(--cp-magenta)',
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '10px',
  padding: '8px 10px',
  cursor: 'pointer'
}
