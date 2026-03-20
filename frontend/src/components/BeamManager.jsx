/**
 * components/BeamManager.jsx — Dynamic Beam Lifecycle Manager
 *
 * Reads beams from swarmStore.
 * Resolves agent positions from OrbitSystem's orbit math.
 * Renders Beam component for each active critique.
 *
 * Position resolution: recomputes orbit positions at render time
 * using same formula as OrbitSystem — single source of truth.
 */

import React, { useMemo } from 'react'
import Beam from './Beam'
import { useSwarmStore, AGENT_NAMES } from '../state/swarmStore'

const ORBIT_RADIUS = 4.2
const ORBIT_Y = 0
const AGENT_COUNT = AGENT_NAMES.length

/**
 * Get current orbit position of an agent by name.
 * Must match OrbitSystem's math exactly.
 */
function getAgentPosition(agentName, currentTime) {
  const i = AGENT_NAMES.indexOf(agentName)
  if (i === -1) return [0, 0, 0]
  const baseOffset = (i / AGENT_COUNT) * Math.PI * 2
  const angle = baseOffset + currentTime * 0.08
  return [
    Math.cos(angle) * ORBIT_RADIUS,
    ORBIT_Y,
    Math.sin(angle) * ORBIT_RADIUS,
  ]
}

export default function BeamManager() {
  const beams = useSwarmStore((s) => s.beams)

  if (beams.length === 0) return null

  // Use performance.now() in seconds for orbit phase sync
  const t = performance.now() / 1000

  return (
    <>
      {beams.map((beam) => {
        const fromPos = getAgentPosition(beam.from, t)
        const toPos   = getAgentPosition(beam.to, t)

        return (
          <Beam
            key={beam.id}
            from={fromPos}
            to={toPos}
            severity={beam.severity}
            createdAt={beam.createdAt}
          />
        )
      })}
    </>
  )
}