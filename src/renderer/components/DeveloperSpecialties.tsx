import type { CSSProperties } from 'react'

export type SpecialtyScore = 'low' | 'medium' | 'high'

export type SpecialtyTag = {
  label: string
  score: SpecialtyScore
}

const SCORE_META: Record<SpecialtyScore, { tone: string; fill: string; border: string; label: string }> = {
  low: {
    tone: 'var(--cp-yellow)',
    fill: 'rgba(255, 230, 0, 0.06)',
    border: 'rgba(255, 230, 0, 0.2)',
    label: 'LOW'
  },
  medium: {
    tone: 'var(--cp-cyan)',
    fill: 'rgba(0, 229, 255, 0.08)',
    border: 'rgba(0, 229, 255, 0.18)',
    label: 'MED'
  },
  high: {
    tone: 'var(--cp-green)',
    fill: 'rgba(0, 255, 136, 0.08)',
    border: 'rgba(0, 255, 136, 0.18)',
    label: 'HIGH'
  }
}

export function describeSpecialties(tags: SpecialtyTag[] | undefined | null) {
  const safeTags = Array.isArray(tags) ? tags.filter((tag) => tag.label.trim()) : []
  if (!safeTags.length) return 'Unspecified'
  return safeTags.map((tag) => `${tag.label} ${tag.score}`).join(' · ')
}

export function normalizeSpecialtyTags(
  tags: Array<Partial<SpecialtyTag> | undefined> | undefined,
  legacySpecialty?: string
): SpecialtyTag[] {
  const cleaned = Array.isArray(tags)
    ? tags
        .filter(Boolean)
        .map((tag) => ({
          label: (tag?.label || '').trim(),
          score: normalizeSpecialtyScore(tag?.score)
        }))
        .filter((tag) => tag.label.length > 0)
    : []

  if (cleaned.length > 0) return cleaned

  const legacyLabel = (legacySpecialty || '').trim()
  if (!legacyLabel) {
    return [{ label: 'backend/rails', score: 'medium' }]
  }

  return [{ label: legacyLabel, score: 'medium' }]
}

export function SpecialtyTagPills({
  tags,
  className,
  style,
  compact = false
}: {
  tags: SpecialtyTag[] | undefined | null
  className?: string
  style?: CSSProperties
  compact?: boolean
}) {
  const safeTags = Array.isArray(tags) ? tags.filter((tag) => tag.label.trim()) : []

  if (!safeTags.length) {
    return (
      <div className={className} style={{ ...style, display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", fontSize: compact ? '9px' : '10px', textTransform: 'uppercase' }}>
        <span style={pillStyle('medium', compact)}>UNSPECIFIED</span>
      </div>
    )
  }

  return (
    <div className={className} style={{ ...style, display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {safeTags.map((tag) => {
        const meta = SCORE_META[normalizeSpecialtyScore(tag.score)]
        return (
          <span
            key={`${tag.label}-${tag.score}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: `1px solid ${meta.border}`,
              background: meta.fill,
              color: meta.tone,
              padding: compact ? '2px 6px' : '3px 7px',
              fontSize: compact ? '9px' : '10px',
              fontFamily: "'Share Tech Mono', monospace",
              textTransform: 'uppercase',
              borderRadius: '2px',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ color: meta.tone }}>{tag.label}</span>
            <span style={{ opacity: 0.8 }}>{meta.label}</span>
          </span>
        )
      })}
    </div>
  )
}

function normalizeSpecialtyScore(score: unknown): SpecialtyScore {
  if (score === 'low' || score === 'medium' || score === 'high') return score
  return 'medium'
}

function pillStyle(score: SpecialtyScore, compact: boolean): CSSProperties {
  const meta = SCORE_META[score]
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    border: `1px solid ${meta.border}`,
    background: meta.fill,
    color: meta.tone,
    padding: compact ? '2px 6px' : '3px 7px',
    fontSize: compact ? '9px' : '10px',
    fontFamily: "'Share Tech Mono', monospace",
    textTransform: 'uppercase',
    borderRadius: '2px',
    whiteSpace: 'nowrap'
  }
}
