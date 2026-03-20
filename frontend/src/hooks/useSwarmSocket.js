/**
 * hooks/useSwarmSocket.js — WebSocket + Event Dispatcher (Phase 5)
 * Phase 5 adds: latency tracking, critique_text pass-through.
 * Ollama fix: longer reconnect delay + heartbeat keepalive.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useSwarmStore } from '../state/swarmStore'

const WS_URL = 'ws://localhost:8000/ws/swarm'
const RECONNECT_DELAY_MS = 60000   // 60s — don't reconnect mid-swarm
const HEARTBEAT_INTERVAL_MS = 20000 // ping every 20s to keep connection alive

export function useSwarmSocket() {
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const heartbeatTimer = useRef(null)
  const pingTime = useRef(null)
  const isRunning = useRef(false)  // track if swarm is active

  const {
    setWsStatus, setLatency,
    resetScene,
    setAgentActive, completeAgent, setAgentError,
    addBeam,
    setDivergence, setTrustScores,
    setConsensus,
    completeSwarm, setSwarmError,
    logEvent,
  } = useSwarmStore()

  const handleEvent = useCallback((event) => {
    const { event_type, payload } = event
    logEvent(event_type, payload)

    switch (event_type) {
      case 'connection_ready':
        setWsStatus('connected')
        break
      case 'swarm_started':
        isRunning.current = true
        resetScene()
        break
      case 'agent_started':
        setAgentActive(payload.agent_name, true)
        break
      case 'agent_completed':
        completeAgent(payload.agent_name, {
          confidence: payload.confidence,
          response: payload.response,
          reasoning_summary: payload.reasoning_summary,
          processing_time: payload.processing_time,
        })
        break
      case 'agent_error':
        setAgentError(payload.agent_name)
        break
      case 'critique_completed':
        addBeam(payload.from_agent, payload.target_agent, payload.severity, payload.critique_text)
        break
      case 'divergence_updated':
        setDivergence(payload.divergence_score)
        break
      case 'trust_updated':
        setTrustScores(payload.trust_scores)
        break
      case 'consensus_ready':
        setConsensus(payload.consensus_result, payload.confidence_score)
        break
      case 'swarm_completed':
        isRunning.current = false
        completeSwarm()
        if (pingTime.current) {
          setLatency(Math.round(Date.now() - pingTime.current))
        }
        break
      case 'swarm_error':
        isRunning.current = false
        setSwarmError()
        break
      default:
        break
    }
  }, []) // eslint-disable-line

  const startHeartbeat = useCallback((ws) => {
    clearInterval(heartbeatTimer.current)
    heartbeatTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping' }))
        } catch (_) {}
      }
    }, HEARTBEAT_INTERVAL_MS)
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    setWsStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      startHeartbeat(ws)
    }

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        // Ignore pong responses
        if (data.type === 'pong') return
        handleEvent(data)
      } catch (e) {
        console.error('[SwarmSocket] Parse error:', e)
      }
    }

    ws.onerror = () => setWsStatus('error')

    ws.onclose = () => {
      clearInterval(heartbeatTimer.current)
      setWsStatus('disconnected')
      wsRef.current = null
      // Don't reconnect immediately if swarm is running
      const delay = isRunning.current ? RECONNECT_DELAY_MS : 3000
      reconnectTimer.current = setTimeout(connect, delay)
    }
  }, [handleEvent, setWsStatus, startHeartbeat])

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current)
    clearInterval(heartbeatTimer.current)
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  const sendPrompt = useCallback((prompt, swarmMode = 'standard') => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false
    pingTime.current = Date.now()
    wsRef.current.send(JSON.stringify({ prompt, swarm_mode: swarmMode }))
    return true
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return { connect, disconnect, sendPrompt }
}