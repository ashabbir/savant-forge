import { AlertTriangle, BarChart3, Brain, Clock3, Users, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SquadSnapshot } from '../services/localState'
import { SpecialtyTagPills } from './DeveloperSpecialties'

type SquadStatsPanelProps = {
  history: SquadSnapshot[]
  latest: SquadSnapshot | null
}

const statusCopy = {
  safe: { label: 'SAFE', tone: 'good', Icon: Zap },
  warning: { label: 'AT CAP', tone: 'warning', Icon: Clock3 },
  overloaded: { label: 'OVERLOADED', tone: 'destructive', Icon: AlertTriangle }
} as const

export function SquadStatsPanel({ history, latest }: SquadStatsPanelProps) {
  const recent = history.slice(-12).reverse()
  const latestStatus = latest ? statusCopy[latest.status] : statusCopy.safe
  const StatusIcon = latestStatus.Icon
  const peakLoad = Math.max(...history.map((item) => item.load_ratio), latest ? latest.load_ratio : 0, 0)
  const deliveredTrend = trendValue(history.map((item) => item.delivered_points))
  const velocityTrend = trendValue(history.map((item) => item.velocity))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
            // SQUAD STATS
          </span>
          <h2 style={{ margin: '4px 0 0', fontSize: '18px', color: 'var(--cp-cyan)', fontFamily: "'Orbitron', sans-serif" }}>
            Delivery, velocity, carryover, capacity
          </h2>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          border: '1px solid var(--cp-border)',
          background: latestStatus.tone === 'destructive'
            ? 'rgba(255, 34, 68, 0.08)'
            : latestStatus.tone === 'warning'
            ? 'rgba(255, 230, 0, 0.06)'
            : 'rgba(0, 255, 136, 0.06)',
          color: latestStatus.tone === 'destructive'
            ? 'var(--cp-magenta)'
            : latestStatus.tone === 'warning'
            ? 'var(--cp-yellow)'
            : 'var(--cp-green)',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '10px',
          fontWeight: 'bold'
        }}>
          <StatusIcon size={12} />
          {latestStatus.label}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
        <Metric label="Velocity" value={`${latest?.velocity || 0} SP`} helper="rolling delivered throughput" />
        <Metric label="Delivered" value={`${latest?.delivered_points || 0} SP`} helper={deliveredTrend} />
        <Metric label="Carryover" value={`${latest?.carryover_points || 0} SP`} helper="work that survived the last snapshot" />
        <Metric label="Peak Load" value={`${Math.round(peakLoad * 100)}%`} helper={velocityTrend} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '12px' }}>
        <Panel title="Squad History" icon={BarChart3}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recent.length === 0 ? (
              <EmptyState text="No squad history captured yet." />
            ) : recent.map((snapshot) => (
              <div key={snapshot.id} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) 54px', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                  {new Date(snapshot.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div style={{ height: '8px', background: 'var(--cp-bg-3)', border: '1px solid var(--cp-border)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(snapshot.load_ratio * 100, 100)}%`,
                      height: '100%',
                      background: snapshot.status === 'overloaded'
                        ? 'linear-gradient(90deg, #ff2244, #ff8800)'
                        : snapshot.status === 'warning'
                        ? 'linear-gradient(90deg, #ffe600, #ffaa00)'
                        : 'linear-gradient(90deg, #00ff88, #00e5ff)'
                    }}
                  />
                </div>
                <span style={{ textAlign: 'right', fontSize: '10px', color: snapshot.status === 'overloaded' ? 'var(--cp-magenta)' : snapshot.status === 'warning' ? 'var(--cp-yellow)' : 'var(--cp-green)', fontFamily: "'Share Tech Mono', monospace" }}>
                  {Math.round(snapshot.load_ratio * 100)}%
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Squad Health" icon={Brain}>
          <div style={{ display: 'grid', gap: '10px', fontSize: '12px' }}>
            <Row label="Raw Aggregate Capacity" value={`${latest?.total_raw_capacity || 0} SP`} />
            <Row label="Safe Capacity (80%)" value={`${latest?.total_effective_capacity.toFixed(0) || '0'} SP`} />
            <Row label="Availability Adjusted" value={`${latest?.available_capacity?.toFixed(0) || '0'} SP`} />
            <Row label="Assigned Workload" value={`${latest?.assigned_points || 0} SP`} />
            <Row label="Delivered Workload" value={`${latest?.delivered_points || 0} SP`} />
            <Row label="Open Workload" value={`${latest?.open_points || 0} SP`} />
            <Row label="Carryover" value={`${latest?.carryover_points || 0} SP`} />
            <Row label="Sprint" value={latest?.sprint_name || 'Unassigned'} />
          </div>
        </Panel>
      </div>

      <Panel title="Developer Ledger" icon={Users}>
        <div style={{ display: 'grid', gap: '8px' }}>
          {latest?.developers?.length ? latest.developers.map((dev) => (
                <div key={dev.developer_id} style={{ border: '1px solid var(--cp-border)', background: 'var(--cp-bg-3)', padding: '10px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) repeat(6, minmax(0, 1fr))', gap: '10px', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{dev.developer_name}</span>
                      <Badge label={dev.workload_label || 'FREE'} />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace" }}>
                      <SpecialtyTagPills tags={dev.specialty_tags} compact />
                      <div style={{ marginTop: '4px' }}>
                        {dev.ranking} · {dev.region || 'global'} · raw {dev.raw_capacity} SP
                      </div>
                    </div>
                  </div>
                  <SmallStat label="Avail" value={`${Math.round((dev.availability_ratio || 1) * 100)}%`} />
                  <SmallStat label="Days" value={`${dev.available_days || 0}/${dev.planned_days || 0}`} />
                  <SmallStat label="Delivered" value={`${dev.delivered_points} SP`} />
                  <SmallStat label="Open" value={`${dev.open_points} SP`} />
                  <SmallStat label="Carryover" value={`${dev.carryover_points} SP`} />
                  <SmallStat label="Utilization" value={`${Math.round((dev.utilization || 0) * 100)}%`} />
                </div>
          )) : (
            <EmptyState text="No developer history available yet." />
          )}
        </div>
      </Panel>
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof BarChart3; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--cp-border)', background: 'var(--cp-bg-2)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--cp-cyan)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        <Icon size={13} />
        {title}
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div style={{ border: '1px solid var(--cp-border)', background: 'var(--cp-bg-2)', padding: '10px' }}>
      <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ marginTop: '4px', fontSize: '16px', fontWeight: 'bold', color: 'var(--foreground)' }}>{value}</div>
      <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--muted-foreground)' }}>{helper}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <strong style={{ color: 'var(--foreground)' }}>{value}</strong>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{value}</div>
    </div>
  )
}

function Badge({ label }: { label: string }) {
  const tone = label === 'OVERWORKED'
    ? { color: 'var(--cp-magenta)', background: 'rgba(255, 34, 68, 0.08)' }
    : label === 'NORMAL'
    ? { color: 'var(--cp-yellow)', background: 'rgba(255, 230, 0, 0.06)' }
    : label === 'HAPPY'
    ? { color: 'var(--cp-green)', background: 'rgba(0, 255, 136, 0.06)' }
    : { color: 'var(--muted-foreground)', background: 'rgba(255,255,255,0.04)' }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 6px',
      border: '1px solid var(--cp-border)',
      color: tone.color,
      background: tone.background,
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '9px',
      fontWeight: 'bold'
    }}>
      {label}
    </span>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '18px 10px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace" }}>
      {text}
    </div>
  )
}

function trendValue(values: number[]) {
  if (values.length < 2) return 'insufficient history'
  const first = values[0]
  const last = values[values.length - 1]
  if (last > first) return `${formatTrend(last - first)} up ${Math.round(((last - first) / Math.max(first || 1, 1)) * 100)}%`
  if (last < first) return `${formatTrend(first - last)} down ${Math.round(((first - last) / Math.max(first || 1, 1)) * 100)}%`
  return 'flat trend'
}

function formatTrend(delta: number) {
  return `${delta.toFixed(0)} SP`
}
