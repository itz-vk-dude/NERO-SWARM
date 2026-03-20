/**
 * ui/AgentInspector.jsx — Agent Detail Inspector
 *
 * Appears when user clicks an agent node (via swarmStore.selectedAgent).
 * Shows: role, trust, confidence, processing time, response excerpt,
 *        reasoning summary, recent critiques given.
 *
 * Slides in from right when an agent is selected.
 */

import React, { useRef, useEffect } from 'react'
import { useSwarmStore, AGENT_COLORS, AGENT_ROLES } from '../state/swarmStore'

export default function AgentInspector() {
  const selectedAgent = useSwarmStore((s) => s.selectedAgent)
  const agents        = useSwarmStore((s) => s.agents)
  const setSelected   = useSwarmStore((s) => s.setSelectedAgent)
  const panelRef      = useRef()

  const agent = selectedAgent ? agents[selectedAgent] : null
  const color = selectedAgent ? AGENT_COLORS[selectedAgent] : '#00e5ff'
  const role  = selectedAgent ? AGENT_ROLES[selectedAgent] : ''

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSelected])

  if (!selectedAgent || !agent) return null

  const agentStatus = agent.error ? 'ERROR'
    : agent.active ? 'PROCESSING'
    : agent.response ? 'COMPLETE'
    : 'STANDBY'

  const statusColor = {
    ERROR: '#ff3864',
    PROCESSING: color,
    COMPLETE: '#00ffb3',
    STANDBY: '#2a4a5a',
  }[agentStatus]

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: '54px',
        right: '20px',
        width: '280px',
        background: 'rgba(3, 8, 18, 0.92)',
        border: `1px solid ${color}28`,
        borderTop: `2px solid ${color}`,
        borderRadius: '3px',
        backdropFilter: 'blur(20px)',
        zIndex: 50,
        animation: 'slideInRight 0.2s ease-out',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: `1px solid ${color}18`,
        background: `${color}08`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }} />
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.15em',
            color,
          }}>
            {selectedAgent.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '9px',
            color: statusColor,
            letterSpacing: '0.1em',
          }}>
            {agentStatus}
          </span>
          <button
            onClick={() => setSelected(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#2a4a5a',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
              padding: '0',
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ padding: '14px' }}>
        {/* Role */}
        <div style={{ marginBottom: '12px' }}>
          <FieldLabel>ROLE</FieldLabel>
          <p style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '12px',
            color: '#6a9aaa',
            lineHeight: 1.5,
            marginTop: '3px',
          }}>
            {role}
          </p>
        </div>

        {/* Stat row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
          marginBottom: '12px',
        }}>
          <StatChip label="TRUST"  value={`${Math.round(agent.trust * 100)}%`}    color={color} />
          <StatChip label="CONF"   value={`${Math.round(agent.confidence * 100)}%`} color="#00ffb3" />
          <StatChip label="TIME"   value={agent.processingTime ? `${agent.processingTime.toFixed(1)}s` : '—'} color="#4a7a9b" />
        </div>

        {/* Reasoning summary */}
        {agent.reasoningSummary && (
          <div style={{ marginBottom: '12px' }}>
            <FieldLabel>REASONING</FieldLabel>
            <p style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: '11px',
              color: '#5a8a9a',
              lineHeight: 1.5,
              marginTop: '4px',
              fontStyle: 'italic',
            }}>
              "{agent.reasoningSummary}"
            </p>
          </div>
        )}

        {/* Response excerpt */}
        {agent.response && (
          <div style={{ marginBottom: '12px' }}>
            <FieldLabel>RESPONSE EXCERPT</FieldLabel>
            <div style={{
              marginTop: '5px',
              padding: '8px 10px',
              background: 'rgba(0, 20, 40, 0.6)',
              border: '1px solid rgba(0,229,255,0.07)',
              borderRadius: '2px',
              maxHeight: '80px',
              overflowY: 'auto',
            }}>
              <p style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '11px',
                color: '#4a7a8a',
                lineHeight: 1.6,
                margin: 0,
              }}>
                {agent.response.slice(0, 280)}{agent.response.length > 280 ? '...' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Recent critiques given */}
        {agent.critiquesGiven && agent.critiquesGiven.length > 0 && (
          <div>
            <FieldLabel>CRITIQUES ISSUED</FieldLabel>
            <div style={{ marginTop: '5px' }}>
              {agent.critiquesGiven.slice(0, 3).map((c, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: i < 2 ? '1px solid rgba(0,229,255,0.04)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: '#2a4a5a', fontSize: '9px', fontFamily: 'monospace' }}>→</span>
                    <span style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '9px',
                      color: '#4a7a8a',
                      letterSpacing: '0.06em',
                    }}>
                      {c.target.toUpperCase()}
                    </span>
                  </div>
                  <SeverityBadge severity={c.severity} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Idle state */}
        {!agent.response && !agent.active && !agent.error && (
          <div style={{
            padding: '12px',
            textAlign: 'center',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '9px',
            color: '#1a3a4a',
            letterSpacing: '0.1em',
          }}>
            AWAITING ACTIVATION
          </div>
        )}
      </div>
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '8px',
      letterSpacing: '0.18em',
      color: '#2a4a5a',
      marginBottom: '2px',
    }}>
      {children}
    </div>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div style={{
      padding: '5px 6px',
      background: 'rgba(0,15,35,0.6)',
      border: '1px solid rgba(0,229,255,0.06)',
      borderRadius: '2px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '12px',
        color,
        letterSpacing: '0.04em',
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '7px',
        color: '#2a4a5a',
        letterSpacing: '0.12em',
        marginTop: '2px',
      }}>
        {label}
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const color = severity > 0.6 ? '#ff3864' : severity > 0.35 ? '#ffcc00' : '#00ffb3'
  const label = severity > 0.6 ? 'HIGH' : severity > 0.35 ? 'MED' : 'LOW'
  return (
    <span style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '8px',
      color,
      letterSpacing: '0.08em',
      padding: '1px 5px',
      border: `1px solid ${color}44`,
      borderRadius: '1px',
    }}>
      {label} {(severity * 100).toFixed(0)}%
    </span>
  )
}