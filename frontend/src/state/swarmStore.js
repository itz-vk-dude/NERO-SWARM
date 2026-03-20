/**
 * state/swarmStore.js — Central Swarm State (Zustand)
 *
 * ALL backend events update this store.
 * ALL 3D components read from this store.
 * No 3D component ever touches WebSocket directly.
 *
 * Phase 3: store exists but data is static/placeholder.
 * Phase 4: useSwarmSocket.js populates it live.
 */

import { create } from 'zustand'

// ── Agent names (must match backend config.AGENT_ORDER) ─────────────
export const AGENT_NAMES = ['Analyst', 'Creative', 'Critic', 'Feasibility', 'Synthesizer']

// ── Agent colors (hue identity per agent) ────────────────────────────
export const AGENT_COLORS = {
  Analyst:     '#00b4d8',
  Creative:    '#7b2fff',
  Critic:      '#ff3864',
  Feasibility: '#00e5b0',
  Synthesizer: '#ffcc00',
}

// ── Agent roles (description per agent) ──────────────────────────────
export const AGENT_ROLES = {
  Analyst:     'Logical breakdown & systems analysis',
  Creative:    'Lateral thinking & novel solutions',
  Critic:      'Flaw identification & risk assessment',
  Feasibility: 'Practical constraints & viability',
  Synthesizer: 'Multi-perspective integration',
}

// ── Default agent state ───────────────────────────────────────────────
const defaultAgent = (name) => ({
  name,
  active: false,
  trust: 0.7,
  confidence: 0.7,
  response: null,
  error: false,
})

const defaultAgents = () =>
  Object.fromEntries(AGENT_NAMES.map((n) => [n, defaultAgent(n)]))

// ── Beam object shape ─────────────────────────────────────────────────
// { id, from, to, severity, createdAt }

// ── Store ─────────────────────────────────────────────────────────────
export const useSwarmStore = create((set, get) => ({

  // ── Connection ───────────────────────────────────────────────────────
  wsStatus: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'

  // ── Swarm runtime ────────────────────────────────────────────────────
  swarmStatus: 'idle', // 'idle' | 'running' | 'complete' | 'error'
  prompt: '',
  swarmMode: 'standard',

  // ── Agent layer ──────────────────────────────────────────────────────
  agents: defaultAgents(),

  // ── Beam layer ───────────────────────────────────────────────────────
  beams: [], // Array of beam objects

  // ── Intelligence layer ───────────────────────────────────────────────
  divergence: 0,
  trustScores: {},
  consensusConfidence: 0,
  consensusResult: '',

  // ── Event log (for UI panel) ─────────────────────────────────────────
  eventLog: [], // Last N events for display

  // ── Actions ──────────────────────────────────────────────────────────
  setWsStatus: (status) => set({ wsStatus: status }),
  setPrompt: (prompt) => set({ prompt }),
  setSwarmMode: (mode) => set({ swarmMode: mode }),

  /** Called when swarm_started event arrives. Resets everything. */
  resetScene: () =>
    set({
      swarmStatus: 'running',
      agents: defaultAgents(),
      beams: [],
      divergence: 0,
      trustScores: {},
      consensusConfidence: 0,
      consensusResult: '',
    }),

  /** agent_started → mark agent active */
  setAgentActive: (name, active) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [name]: { ...state.agents[name], active, error: false },
      },
    })),

  /** agent_completed → update agent data, mark inactive */
  completeAgent: (name, data) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [name]: {
          ...state.agents[name],
          active: false,
          confidence: data.confidence ?? state.agents[name].confidence,
          response: data.response ?? null,
        },
      },
    })),

  /** agent_error → mark error */
  setAgentError: (name) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [name]: { ...state.agents[name], active: false, error: true },
      },
    })),

  /** critique_completed → add beam */
  addBeam: (from, to, severity) => {
    const beam = {
      id: `${from}-${to}-${Date.now()}`,
      from,
      to,
      severity,
      createdAt: Date.now(),
    }
    set((state) => ({ beams: [...state.beams, beam] }))

    // Auto-remove beam after 2.5 seconds
    setTimeout(() => {
      set((state) => ({
        beams: state.beams.filter((b) => b.id !== beam.id),
      }))
    }, 2500)
  },

  /** divergence_updated */
  setDivergence: (score) => set({ divergence: score }),

  /** trust_updated → update per-agent trust */
  setTrustScores: (scores) => {
    set((state) => {
      const updatedAgents = { ...state.agents }
      Object.entries(scores).forEach(([name, trust]) => {
        if (updatedAgents[name]) {
          updatedAgents[name] = { ...updatedAgents[name], trust }
        }
      })
      return { trustScores: scores, agents: updatedAgents }
    })
  },

  /** consensus_ready */
  setConsensus: (result, confidence) =>
    set({ consensusResult: result, consensusConfidence: confidence }),

  /** swarm_completed */
  completeSwarm: () => set({ swarmStatus: 'complete' }),

  /** swarm_error */
  setSwarmError: () => set({ swarmStatus: 'error' }),

  /** Append to event log (capped at 50 entries) */
  logEvent: (type, payload) =>
    set((state) => ({
      eventLog: [
        { type, payload, ts: Date.now() },
        ...state.eventLog,
      ].slice(0, 50),
    })),
}))