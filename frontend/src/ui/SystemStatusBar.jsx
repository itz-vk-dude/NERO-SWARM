/**
 * ui/SystemStatusBar.jsx — Top System Status Bar
 *
 * Shows: swarm status label, execution timer, FPS, latency, WS status.
 * Updates FPS via useFrame in a hidden canvas-bridge component.
 * Never causes canvas re-renders from React side.
 */

import React, { useEffect, useRef } from 'react'
import { useSwarmStore } from '../state/swarmStore'

// ── Status definitions ────────────────────────────────────────────
const STATUS_CONFIG = {
  idle:     { label: 'STANDBY',           color: '#3a5a6a', pulse: false },
  running:  { label: 'SWARM ACTIVE',      color: '#00e5ff', pulse: true  },
  complete: { label: 'CONSENSUS REACHED', color: '#00ffb3', pulse: false },
  error:    { label: 'SYSTEM FAULT',      color: '#ff3864', pulse: true  },
}

const WS_CONFIG = {
  disconnected: { label: 'OFFLINE',     color: '#ff3864' },
  connecting:   { label: 'HANDSHAKE',   color: '#ffcc00' },
  connected:    { label: 'LINK ACTIVE', color: '#00ffb3' },
  error:        { label: 'LINK ERROR',  color: '#ff3864' },
}

export default function SystemStatusBar() {
  const swarmStatus = useSwarmStore((s) => s.swarmStatus)
  const wsStatus    = useSwarmStore((s) => s.wsStatus)
  const fps         = useSwarmStore((s) => s.fps)
  const latency     = useSwarmStore((s) => s.latency)
  const elapsedTime = useSwarmStore((s) => s.elapsedTime)
  const executionTime = useSwarmStore((s) => s.executionTime)
  const tickElapsed = useSwarmStore((s) => s.tickElapsed)

  // Live elapsed timer tick during run
  useEffect(() => {
    if (swarmStatus !== 'running') return
    const interval = setInterval(tickElapsed, 100)
    return () => clearInterval(interval)
  }, [swarmStatus, tickElapsed])

  const sc = STATUS_CONFIG[swarmStatus] || STATUS_CONFIG.idle
  const wc = WS_CONFIG[wsStatus] || WS_CONFIG.disconnected

  const displayTime = swarmStatus === 'complete' && executionTime != null
    ? executionTime.toFixed(1)
    : swarmStatus === 'running'
    ? elapsedTime.toFixed(1)
    : null

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: '44px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      background: 'rgba(4, 8, 18, 0.92)',
      borderBottom: '1px solid rgba(0, 229, 255, 0.08)',
      backdropFilter: 'blur(20px)',
      zIndex: 100,
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '10px',
      letterSpacing: '0.14em',
    }}>

      {/* Left — branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity="0.5"/>
            <circle cx="7" cy="7" r="2.5" fill="#00e5ff" fillOpacity="0.9"/>
            <line x1="7" y1="1" x2="7" y2="4" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity="0.6"/>
            <line x1="7" y1="10" x2="7" y2="13" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity="0.6"/>
            <line x1="1" y1="7" x2="4" y2="7" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity="0.6"/>
            <line x1="10" y1="7" x2="13" y2="7" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity="0.6"/>
          </svg>
          <span style={{ color: '#00e5ff', letterSpacing: '0.2em' }}>SIE</span>
          <span style={{ color: '#1a3a4a', letterSpacing: '0.1em' }}>NEURAL CONTROL</span>
        </div>

        <Divider />

        {/* Swarm status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <PulsingDot color={sc.color} pulse={sc.pulse} />
          <span style={{ color: sc.color }}>{sc.label}</span>
        </div>
      </div>

      {/* Center — timer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {displayTime != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ color: '#1a3a4a' }}>T+</span>
            <span style={{ color: swarmStatus === 'complete' ? '#00ffb3' : '#00e5ff' }}>
              {displayTime}s
            </span>
          </div>
        )}
      </div>

      {/* Right — sys metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <MetricPill label="FPS" value={fps} good={fps >= 55} warn={fps < 45} />
        <MetricPill
          label="LAT"
          value={latency != null ? `${latency}ms` : '—'}
          good={latency != null && latency < 200}
          warn={latency != null && latency > 500}
        />

        <Divider />

        {/* WS status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '5px', height: '5px',
            borderRadius: '50%',
            background: wc.color,
            boxShadow: `0 0 5px ${wc.color}`,
          }} />
          <span style={{ color: wc.color, fontSize: '9px' }}>{wc.label}</span>
        </div>

        <Divider />
        <span style={{ color: '#1a3a4a' }}>v2.0</span>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function PulsingDot({ color, pulse }) {
  return (
    <div style={{
      width: '6px', height: '6px',
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 6px ${color}`,
      animation: pulse ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
    }}>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}

function MetricPill({ label, value, good, warn }) {
  const color = warn ? '#ffcc00' : good ? '#00ffb3' : '#4a7a9b'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ color: '#1a3a4a' }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}

function Divider() {
  return (
    <div style={{
      width: '1px', height: '14px',
      background: 'rgba(0,229,255,0.1)',
    }} />
  )
}