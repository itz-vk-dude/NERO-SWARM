/**
 * ui/MetricsPanel.jsx — Live Intelligence Metrics Panel
 *
 * Displays: divergence, confidence, avg trust, active agents,
 * beam count (critique intensity), execution time.
 *
 * Designed as a right-side glass instrument panel.
 * Numbers only — no charts. Pure signal readout.
 */

import React, { useMemo } from 'react'
import { useSwarmStore, AGENT_NAMES } from '../state/swarmStore'

export default function MetricsPanel() {
  const agents            = useSwarmStore((s) => s.agents)
  const divergence        = useSwarmStore((s) => s.divergence)
  const consensusConf     = useSwarmStore((s) => s.consensusConfidence)
  const beams             = useSwarmStore((s) => s.beams)
  const swarmStatus       = useSwarmStore((s) => s.swarmStatus)
  const executionTime     = useSwarmStore((s) => s.executionTime)
  const elapsedTime       = useSwarmStore((s) => s.elapsedTime)

  const activeCount   = useMemo(() => Object.values(agents).filter((a) => a.active).length, [agents])
  const avgTrust      = useMemo(() => {
    const vals = Object.values(agents).map((a) => a.trust)
    return vals.reduce((s, v) => s + v, 0) / vals.length
  }, [agents])
  const avgConf       = useMemo(() => {
    const vals = Object.values(agents).filter((a) => a.confidence).map((a) => a.confidence)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  }, [agents])
  const completedCount = useMemo(() =>
    Object.values(agents).filter((a) => a.response != null).length, [agents])

  const displayTime = swarmStatus === 'complete' && executionTime != null
    ? `${executionTime.toFixed(2)}s`
    : swarmStatus === 'running'
    ? `${elapsedTime.toFixed(1)}s`
    : '—'

  const systemHealth = swarmStatus === 'complete'
    ? 1 - divergence * 0.4 + consensusConf * 0.3
    : swarmStatus === 'running'
    ? 0.5 + avgTrust * 0.3
    : 0

  return (
    <div style={{
      width: '198px',
      background: 'rgba(4, 10, 22, 0.82)',
      border: '1px solid rgba(0, 229, 255, 0.1)',
      borderRadius: '3px',
      backdropFilter: 'blur(18px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <PanelHeader label="INTELLIGENCE METRICS" />

      <div style={{ padding: '12px' }}>
        {/* System health bar */}
        <HealthBar value={Math.min(1, Math.max(0, systemHealth))} status={swarmStatus} />

        <Spacer />

        {/* Key metrics */}
        <MetricRow
          label="DIVERGENCE"
          value={`${(divergence * 100).toFixed(1)}%`}
          bar={divergence}
          barColor={divergence > 0.6 ? '#ff3864' : divergence > 0.35 ? '#ffcc00' : '#00e5ff'}
          warn={divergence > 0.6}
        />
        <MetricRow
          label="CONFIDENCE"
          value={`${(consensusConf * 100).toFixed(1)}%`}
          bar={consensusConf}
          barColor="#00ffb3"
        />
        <MetricRow
          label="AVG TRUST"
          value={`${(avgTrust * 100).toFixed(1)}%`}
          bar={avgTrust}
          barColor="#00b4d8"
        />
        <MetricRow
          label="AVG AGENT CONF"
          value={`${(avgConf * 100).toFixed(1)}%`}
          bar={avgConf}
          barColor="#7b2fff"
        />

        <Spacer />

        {/* Count metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '4px',
        }}>
          <CountBox label="ACTIVE" value={activeCount} color="#00e5ff" />
          <CountBox label="COMPLETE" value={completedCount} color="#00ffb3" />
          <CountBox label="CRITIQUES" value={beams.length} color="#ff9500" />
          <CountBox label="AGENTS" value={AGENT_NAMES.length} color="#4a7a9b" />
        </div>

        <Spacer />

        {/* Execution time */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 0',
          borderTop: '1px solid rgba(0,229,255,0.07)',
        }}>
          <span style={labelStyle}>EXEC TIME</span>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '13px',
            color: swarmStatus === 'complete' ? '#00ffb3' : '#4a7a9b',
            letterSpacing: '0.05em',
          }}>{displayTime}</span>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

const labelStyle = {
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: '9px',
  color: '#2a4a5a',
  letterSpacing: '0.12em',
}

function PanelHeader({ label }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderBottom: '1px solid rgba(0,229,255,0.08)',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '9px',
      letterSpacing: '0.18em',
      color: '#2a5a6a',
    }}>
      {label}
    </div>
  )
}

function Spacer() {
  return <div style={{ height: '8px' }} />
}

function HealthBar({ value, status }) {
  const color = status === 'complete' ? '#00ffb3'
    : status === 'error' ? '#ff3864'
    : status === 'running' ? '#00e5ff'
    : '#1a3a4a'

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginBottom: '4px',
      }}>
        <span style={labelStyle}>SYSTEM HEALTH</span>
        <span style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '9px',
          color,
          letterSpacing: '0.08em',
        }}>
          {status === 'idle' ? 'STANDBY' : `${Math.round(value * 100)}%`}
        </span>
      </div>
      <div style={{
        width: '100%', height: '3px',
        background: '#0a1e2e',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${value * 100}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: '2px',
          transition: 'width 1s ease',
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
    </div>
  )
}

function MetricRow({ label, value, bar, barColor, warn }) {
  return (
    <div style={{ marginBottom: '9px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '3px',
      }}>
        <span style={labelStyle}>{label}</span>
        <span style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '11px',
          color: warn ? '#ff3864' : '#8ab4c4',
          letterSpacing: '0.05em',
        }}>
          {value}
        </span>
      </div>
      <div style={{
        width: '100%', height: '2px',
        background: '#0a1828',
        borderRadius: '1px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${(bar || 0) * 100}%`,
          height: '100%',
          background: barColor,
          opacity: 0.75,
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  )
}

function CountBox({ label, value, color }) {
  return (
    <div style={{
      padding: '6px 8px',
      background: 'rgba(0,20,40,0.5)',
      border: '1px solid rgba(0,229,255,0.06)',
      borderRadius: '2px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '16px',
        color,
        lineHeight: 1.1,
        letterSpacing: '0.05em',
      }}>
        {value}
      </div>
      <div style={{ ...labelStyle, fontSize: '8px', marginTop: '2px' }}>{label}</div>
    </div>
  )
}