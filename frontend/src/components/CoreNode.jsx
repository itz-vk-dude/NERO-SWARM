/**
 * components/CoreNode.jsx — Central Consensus Core
 *
 * Represents the swarm's collective intelligence.
 * Pulses softly at rest. Expands + brightens during consensus.
 * Reacts to divergence with subtle instability.
 *
 * Props:
 *   confidence    (0–1) → emissive intensity
 *   divergence    (0–1) → instability wobble
 *   swarmStatus   string → 'idle' | 'running' | 'complete'
 */

import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere } from '@react-three/drei'
import * as THREE from 'three'

function CoreNode({ confidence = 0.5, divergence = 0, swarmStatus = 'idle' }) {
  const meshRef = useRef()
  const innerRef = useRef()
  const timeRef = useRef(0)

  // Lerp targets
  const targetScale = useRef(1)
  const currentScale = useRef(1)
  const currentEmissive = useRef(0.4)

  const coreMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#001a3a'),
    emissive: new THREE.Color('#0066ff'),
    emissiveIntensity: 0.4,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.92,
  }), [])

  const innerMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#003366'),
    emissive: new THREE.Color('#00e5ff'),
    emissiveIntensity: 0.9,
    roughness: 0.0,
    metalness: 1.0,
    transparent: true,
    opacity: 0.6,
  }), [])

  useFrame((state, delta) => {
    timeRef.current += delta

    const t = timeRef.current
    const isRunning = swarmStatus === 'running'
    const isComplete = swarmStatus === 'complete'

    // ── Target scale ────────────────────────────────────────
    if (isComplete) {
      targetScale.current = 1.0 + confidence * 0.35
    } else if (isRunning) {
      targetScale.current = 1.05
    } else {
      targetScale.current = 1.0
    }

    // ── Pulse ────────────────────────────────────────────────
    const pulseFreq = isRunning ? 1.8 : 0.8
    const pulseAmp  = isRunning ? 0.05 : 0.025
    const pulse = Math.sin(t * pulseFreq * Math.PI * 2) * pulseAmp

    // ── Divergence instability ────────────────────────────────
    const wobble = divergence > 0.3
      ? Math.sin(t * 7.3) * divergence * 0.03
      : 0

    // ── Lerp scale ────────────────────────────────────────────
    currentScale.current = THREE.MathUtils.lerp(
      currentScale.current,
      targetScale.current,
      delta * 2.0
    )

    const finalScale = currentScale.current + pulse + wobble

    if (meshRef.current) {
      meshRef.current.scale.setScalar(finalScale)
    }

    // ── Emissive intensity ────────────────────────────────────
    const targetEmissive = isComplete
      ? 0.4 + confidence * 1.2
      : isRunning
      ? 0.6 + Math.sin(t * 2) * 0.15
      : 0.4

    currentEmissive.current = THREE.MathUtils.lerp(
      currentEmissive.current,
      targetEmissive,
      delta * 1.5
    )

    coreMaterial.emissiveIntensity = currentEmissive.current

    // ── Inner sphere ──────────────────────────────────────────
    if (innerRef.current) {
      const innerScale = 0.55 + Math.sin(t * 1.5) * 0.03
      innerRef.current.scale.setScalar(innerScale)
      innerMaterial.emissiveIntensity = 0.8 + confidence * 0.4
      innerMaterial.opacity = 0.4 + confidence * 0.25
    }
  })

  return (
    <group>
      {/* Outer core */}
      <mesh ref={meshRef} material={coreMaterial}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>

      {/* Inner bright core */}
      <mesh ref={innerRef} material={innerMaterial}>
        <sphereGeometry args={[1, 32, 32]} />
      </mesh>

      {/* Outer halo ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.35, 0.012, 16, 100]} />
        <meshStandardMaterial
          color="#00e5ff"
          emissive="#00e5ff"
          emissiveIntensity={0.6}
          transparent
          opacity={0.5}
        />
      </mesh>

      <mesh rotation={[Math.PI / 3, 0, Math.PI / 4]}>
        <torusGeometry args={[1.28, 0.006, 16, 100]} />
        <meshStandardMaterial
          color="#0066ff"
          emissive="#0066ff"
          emissiveIntensity={0.4}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  )
}

export default React.memo(CoreNode)