/**
 * ui/ControlPanel.jsx — Swarm Command & Control Panel
 *
 * Left glass panel. Input prompt, mode selector, start/reset buttons.
 * Also shows consensus output when complete.
 *
 * Collapsed by default with expand toggle to keep scene visible.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useSwarmStore } from '../state/swarmStore'

const MODES = [
  { id: 'standard',  label: 'STANDARD',  desc: 'Balanced intelligence' },
  { id: 'creative',  label: 'CREATIVE',  desc: 'Lateral thinking amplified' },
  { id: 'critical',  label: 'CRITICAL',  desc: 'Maximum rigor' },
]

export default function ControlPanel({ onSendPrompt }) {
  const swarmStatus    = useSwarmStore((s) => s.swarmStatus)
  const swarmMode      = useSwarmStore((s) => s.swarmMode)
  const setSwarmMode   = useSwarmStore((s) => s.setSwarmMode)
  const consensusResult = useSwarmStore((s) => s.consensusResult)
  const consensusConf  = useSwarmStore((s) => s.consensusConfidence)
  const resetScene     = useSwarmStore((s) => s.resetScene)

  const [inputValue, setInputValue]   = useState('')
  const [collapsed, setCollapsed]     = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const textareaRef = useRef()

  const isRunning = swarmStatus === 'running'

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || isRunning) return
    onSendPrompt(trimmed, swarmMode)
    // Don't clear — let user see what was sent
  }, [inputValue, swarmMode, isRunning, onSendPrompt])

  const handleReset = useCallback(() => {
    setInputValue('')
    // resetScene() is triggered by the next prompt send; manual reset = clear input
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleCopy = () => {
    if (!consensusResult) return
    navigator.clipboard.writeText(consensusResult).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 1500)
    })
  }

  return (
    <div style={{
      width: collapsed ? '42px' : '240px',
      transition: 'width 0.25s ease',
      background: 'rgba(4, 10, 22, 0.82)',
      border: '1px solid rgba(0, 229, 255, 0.1)',
      borderRadius: '3px',
      backdropFilter: 'blur(18px)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Header with collapse toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(0,229,255,0.08)',
        cursor: 'pointer',
        flexShrink: 0,
      }} onClick={() => setCollapsed(!collapsed)}>
        {!collapsed && (
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '9px',
            letterSpacing: '0.18em',
            color: '#2a5a6a',
          }}>
            CONTROL INTERFACE
          </span>
        )}
        <span style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '11px',
          color: '#00e5ff',
          lineHeight: 1,
          transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 0.25s ease',
        }}>
          ›
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>

          {/* Mode selector */}
          <div>
            <FieldLabel>ANALYSIS MODE</FieldLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSwarmMode(m.id)}
                  disabled={isRunning}
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '9px',
                    letterSpacing: '0.12em',
                    padding: '6px 10px',
                    textAlign: 'left',
                    background: swarmMode === m.id
                      ? 'rgba(0,229,255,0.08)'
                      : 'rgba(0,10,20,0.4)',
                    border: `1px solid ${swarmMode === m.id ? 'rgba(0,229,255,0.25)' : 'rgba(0,229,255,0.06)'}`,
                    borderRadius: '2px',
                    color: swarmMode === m.id ? '#00e5ff' : '#2a5a6a',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: isRunning ? 0.5 : 1,
                  }}
                >
                  <div>{m.label}</div>
                  <div style={{
                    fontSize: '8px',
                    color: swarmMode === m.id ? '#4a9aaa' : '#1a3a4a',
                    marginTop: '1px',
                    fontFamily: "'Rajdhani', sans-serif",
                    letterSpacing: '0.04em',
                  }}>
                    {m.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt input */}
          <div>
            <FieldLabel>ANALYSIS QUERY</FieldLabel>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a question or problem for the swarm to analyze..."
              disabled={isRunning}
              rows={4}
              style={{
                marginTop: '6px',
                width: '100%',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '12px',
                lineHeight: 1.55,
                padding: '8px 10px',
                background: 'rgba(0, 12, 28, 0.7)',
                border: '1px solid rgba(0,229,255,0.1)',
                borderRadius: '2px',
                color: '#8ab4c4',
                outline: 'none',
                resize: 'none',
                opacity: isRunning ? 0.5 : 1,
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '8px',
              color: '#1a3a4a',
              marginTop: '3px',
              textAlign: 'right',
            }}>
              CTRL+ENTER TO SEND
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleSubmit}
              disabled={isRunning || !inputValue.trim()}
              style={{
                flex: 1,
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.14em',
                padding: '8px 0',
                background: isRunning
                  ? 'rgba(0,229,255,0.03)'
                  : 'rgba(0, 102, 255, 0.15)',
                border: `1px solid ${isRunning ? 'rgba(0,229,255,0.06)' : 'rgba(0,102,255,0.4)'}`,
                borderRadius: '2px',
                color: isRunning ? '#1a3a4a' : '#00e5ff',
                cursor: isRunning || !inputValue.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {isRunning ? '● RUNNING' : '▶ ACTIVATE'}
            </button>

            <button
              onClick={handleReset}
              disabled={isRunning}
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.1em',
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,229,255,0.06)',
                borderRadius: '2px',
                color: '#2a4a5a',
                cursor: isRunning ? 'not-allowed' : 'pointer',
              }}
            >
              ↺
            </button>
          </div>

          {/* Consensus output */}
          {swarmStatus === 'complete' && consensusResult && (
            <div style={{
              borderTop: '1px solid rgba(0,229,255,0.08)',
              paddingTop: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <FieldLabel>CONSENSUS OUTPUT</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '8px',
                    color: '#00ffb3',
                    letterSpacing: '0.08em',
                  }}>
                    {Math.round(consensusConf * 100)}%
                  </span>
                  <button
                    onClick={handleCopy}
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '8px',
                      color: copyFeedback ? '#00ffb3' : '#2a5a6a',
                      background: 'none',
                      border: '1px solid rgba(0,229,255,0.08)',
                      borderRadius: '2px',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      letterSpacing: '0.08em',
                      transition: 'color 0.2s',
                    }}
                  >
                    {copyFeedback ? '✓' : 'COPY'}
                  </button>
                </div>
              </div>

              <div
                className="scrollable"
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  padding: '8px 10px',
                  background: 'rgba(0, 20, 40, 0.5)',
                  border: '1px solid rgba(0,229,255,0.08)',
                  borderLeft: '2px solid rgba(0,229,255,0.3)',
                  borderRadius: '0 2px 2px 0',
                }}
              >
                <p style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: '11px',
                  color: '#6a9aaa',
                  lineHeight: 1.65,
                  margin: 0,
                }}>
                  {consensusResult}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
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
    }}>
      {children}
    </div>
  )
}