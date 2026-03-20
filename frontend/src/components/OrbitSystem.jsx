/**
 * components/OrbitSystem.jsx — 5-Agent Orbit System
 *
 * Positions 5 agents in circular orbit around core.
 * Handles orbit animation with useFrame.
 * Each agent offset evenly (72° apart).
 *
 * Reads from swarmStore — no props drilling.
 */

import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import AgentNode from './AgentNode'
import { useSwarmStore, AGENT_NAMES, AGENT_COLORS } from '../state/swarmStore'

const ORBIT_RADIUS = 4.2
const ORBIT_Y = 0           // flat orbit plane (tilt handled by camera angle)
const ORBIT_SPEED = 0.08    // radians per second — slow, contemplative
const AGENT_COUNT = AGENT_NAMES.length

// Evenly spaced angle offsets for 5 agents
const BASE_OFFSETS = AGENT_NAMES.map((_, i) => (i / AGENT_COUNT) * Math.PI * 2)

export default function OrbitSystem() {
  const groupRef = useRef()
  const timeRef = useRef(0)
  // Per-agent position refs (avoid re-creating arrays)
  const positionsRef = useRef(AGENT_NAMES.map(() => [0, ORBIT_Y, 0]))

  const agents = useSwarmStore((s) => s.agents)

  useFrame((state, delta) => {
    timeRef.current += delta * ORBIT_SPEED

    const t = timeRef.current

    // Update each agent's position ref
    AGENT_NAMES.forEach((name, i) => {
      const angle = BASE_OFFSETS[i] + t
      positionsRef.current[i] = [
        Math.cos(angle) * ORBIT_RADIUS,
        ORBIT_Y,
        Math.sin(angle) * ORBIT_RADIUS,
      ]
    })

    // Force group update (positions read by children)
    if (groupRef.current) {
      groupRef.current.rotation.y = 0 // orbit is per-node, not group rotation
    }
  })

  return (
    <group ref={groupRef}>
      {AGENT_NAMES.map((name, i) => {
        const agent = agents[name]
        return (
          <AgentNodeWrapper
            key={name}
            name={name}
            index={i}
            positionsRef={positionsRef}
            agent={agent}
          />
        )
      })}
    </group>
  )
}

/**
 * Wrapper that reads position from ref each frame via useFrame.
 * Avoids React state updates per frame (performance critical).
 */
function AgentNodeWrapper({ name, index, positionsRef, agent }) {
  const meshGroupRef = useRef()

  useFrame(() => {
    if (meshGroupRef.current) {
      const [x, y, z] = positionsRef.current[index]
      meshGroupRef.current.position.set(x, y, z)
    }
  })

  return (
    <group ref={meshGroupRef}>
      <AgentNode
        position={[0, 0, 0]}
        agentName={name}
        color={AGENT_COLORS[name]}
        isActive={agent?.active ?? false}
        trustLevel={agent?.trust ?? 0.7}
        hasError={agent?.error ?? false}
      />
    </group>
  )
}