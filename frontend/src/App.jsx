/**
 * App.jsx — Phase 5 Complete Layout
 *
 * Layers (bottom → top z):
 *   1. NeuralScene (full-screen 3D canvas)
 *   2. SystemStatusBar (top bar)
 *   3. ControlPanel (left)
 *   4. MetricsPanel (right bottom)
 *   5. AgentInspector (right, overlays metrics when agent selected)
 *   6. EventLog strip (bottom right, compact)
 *
 * Key: UI panels are separate from Canvas. No UI state causes Canvas re-renders.
 */

import React, { useCallback, useRef } from 'react'
import NeuralScene from './scene/Neural_Scene.jsx'
import SystemStatusBar from './ui/SystemStatusBar'
import ControlPanel from './ui/ControlPanel'
import MetricsPanel from './ui/MetricsPanel'
import AgentInspector from './ui/AgentInspector'
import { useSwarmSocket } from './hooks/useSwarmSocket'
import { useSwarmStore, AGENT_COLORS } from './state/swarmStore'

export default function App() {
  const { sendPrompt } = useSwarmSocket()

  const setPrompt    = useSwarmStore((s) => s.setPrompt)
  const swarmMode    = useSwarmStore((s) => s.swarmMode)
  const swarmStatus  = useSwarmStore((s) => s.swarmStatus)
  const eventLog     = useSwarmStore((s) => s.eventLog)
  const selectedAgent = useSwarmStore((s) => s.selectedAgent)

  const handleSendPrompt = useCallback((prompt, mode) => {
    setPrompt(prompt)
    sendPrompt(prompt, mode || swarmMode)
  }, [setPrompt, sendPrompt, swarmMode])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: '#040810',
    }}>
      {/* ── Layer 1: 3D Canvas ─────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <NeuralScene />
      </div>

      {/* ── Layer 2: System Status Bar ─────────────────────────── */}
      <SystemStatusBar />

      {/* ── Layer 3: Main UI overlay ───────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: '54px',
        left: 0, right: 0, bottom: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '12px 14px',
        pointerEvents: 'none', // let 3D scene receive pointer events
        zIndex: 10,
      }}>

        {/* Left — Control Panel */}
        <div style={{ pointerEvents: 'auto', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
          <ControlPanel onSendPrompt={handleSendPrompt} />
        </div>

        {/* Right — Metrics + Inspector stacked */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          pointerEvents: 'auto',
          alignItems: 'flex-end',
        }}>
          {/* Agent inspector slides in when selected */}
          <AgentInspector />

          {!selectedAgent && (
            <MetricsPanel />
          )}

          {/* Compact event log */}
          <EventLogStrip events={eventLog} />
        </div>
      </div>

      {/* Corner watermark */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '9px',
        letterSpacing: '0.2em',
        color: 'rgba(0,229,255,0.12)',
        pointerEvents: 'none',
        zIndex: 5,
      }}>
        SWARM INTELLIGENCE ENGINE  ·  NEURAL INTERFACE  ·  PHASE 5
      </div>
    </div>
  )
}

// ── Compact Event Log Strip ────────────────────────────────────────
const EVENT_COLORS = {
  swarm_started:       '#00e5ff',
  swarm_completed:     '#00ffb3',
  agent_started:       '#7b2fff',
  agent_completed:     '#00b4d8',
  agent_error:         '#ff3864',
  critique_completed:  '#ff9500',
  divergence_updated:  '#ffcc00',
  trust_updated:       '#00ffb3',
  consensus_ready:     '#00e5ff',
  swarm_error:         '#ff3864',
}

function EventLogStrip({ events }) {
  if (!events.length) return null

  return (
    <div style={{
      width: '198px',
      maxHeight: '240px',
      background: 'rgba(4, 10, 22, 0.75)',
      border: '1px solid rgba(0, 229, 255, 0.08)',
      borderRadius: '3px',
      backdropFilter: 'blur(14px)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '6px 10px',
        borderBottom: '1px solid rgba(0,229,255,0.06)',
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '8px',
        letterSpacing: '0.18em',
        color: '#1a3a4a',
        flexShrink: 0,
      }}>
        EVENT STREAM
      </div>
      <div
        className="scrollable"
        style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}
      >
        {events.slice(0, 20).map((entry, i) => {
          const color = EVENT_COLORS[entry.type] || '#2a4a5a'
          const label = entry.type.replace(/_/g, ' ')
          const p = entry.payload

          let detail = ''
          if (entry.type === 'agent_started')     detail = p.agent_name
          if (entry.type === 'agent_completed')   detail = `${p.agent_name}`
          if (entry.type === 'agent_error')       detail = p.agent_name
          if (entry.type === 'critique_completed') detail = `${p.from_agent}→${p.target_agent}`
          if (entry.type === 'divergence_updated') detail = `${(p.divergence_score * 100).toFixed(1)}%`
          if (entry.type === 'consensus_ready')   detail = `${(p.confidence_score * 100).toFixed(0)}%`

          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '5px',
              marginBottom: '4px',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '8.5px',
              lineHeight: 1.4,
            }}>
              <span style={{ color, flexShrink: 0 }}>›</span>
              <div style={{ overflow: 'hidden' }}>
                <span style={{ color: `${color}cc`, letterSpacing: '0.06em' }}>
                  {label}
                </span>
                {detail && (
                  <span style={{ color: '#2a4a5a', marginLeft: '4px' }}>
                    {detail}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}