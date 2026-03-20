/**
 * components/BackgroundParticles.jsx — Subtle Lab Atmosphere Particles
 *
 * Max 180 particles. Slow drift. Nearly invisible.
 * Uses BufferGeometry points — zero individual mesh overhead.
 * No state updates per frame — entirely ref-driven.
 */

import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 180
const SPREAD = 28
const DRIFT_SPEED = 0.012

export default function BackgroundParticles() {
  const pointsRef = useRef()

  // Generate initial positions, velocities, phases once
  const { positions, velocities, phases } = useMemo(() => {
    const positions  = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const phases     = new Float32Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * SPREAD
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD * 0.5
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD

      // Very slow vertical drift + slight lateral wander
      velocities[i * 3]     = (Math.random() - 0.5) * 0.002
      velocities[i * 3 + 1] = Math.random() * 0.003 + 0.001
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002

      phases[i] = Math.random() * Math.PI * 2
    }

    return { positions, velocities, phases }
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  const mat = useMemo(() => new THREE.PointsMaterial({
    color: '#00e5ff',
    size: 0.04,
    transparent: true,
    opacity: 0.18,
    sizeAttenuation: true,
    depthWrite: false,
  }), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pos = pointsRef.current.geometry.attributes.position.array

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3

      // Drift upward with slight sinusoidal wander
      pos[idx]     += velocities[idx]     + Math.sin(t * 0.3 + phases[i]) * 0.0005
      pos[idx + 1] += velocities[idx + 1]
      pos[idx + 2] += velocities[idx + 2] + Math.cos(t * 0.2 + phases[i]) * 0.0005

      // Wrap vertically
      if (pos[idx + 1] > SPREAD * 0.25) {
        pos[idx + 1] = -SPREAD * 0.25
        pos[idx]     = (Math.random() - 0.5) * SPREAD
        pos[idx + 2] = (Math.random() - 0.5) * SPREAD
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geo} material={mat} />
}