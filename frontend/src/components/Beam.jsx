/**
 * components/Beam.jsx — Critique Beam
 *
 * Animated connection beam between two agent nodes.
 * Thickness + opacity driven by severity.
 * Fades in quickly, then fades out over 2.5s lifetime.
 *
 * Props:
 *   from     [x,y,z]
 *   to       [x,y,z]
 *   severity 0–1
 *   createdAt timestamp (ms)
 */

import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const BEAM_LIFETIME_MS = 2500

function Beam({ from, to, severity, createdAt }) {
  const meshRef = useRef()

  // Beam geometry: a cylinder from `from` to `to`
  const { midpoint, length, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end   = new THREE.Vector3(...to)
    const mid   = start.clone().add(end).multiplyScalar(0.5)
    const dir   = end.clone().sub(start)
    const len   = dir.length()
    const up    = new THREE.Vector3(0, 1, 0)
    const q     = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize())
    return { midpoint: mid, length: len, quaternion: q }
  }, [from, to])

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#00ffcc'),
    emissive: new THREE.Color('#00ffcc'),
    emissiveIntensity: 1.5 + severity * 1.0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), [severity])

  const radius = 0.012 + severity * 0.035

  useFrame(() => {
    const age = (Date.now() - createdAt) / BEAM_LIFETIME_MS // 0→1
    // Fast fade-in (first 10%), slow fade-out (rest)
    const opacity = age < 0.1
      ? (age / 0.1) * (0.4 + severity * 0.45)
      : ((1 - age) / 0.9) * (0.4 + severity * 0.45)

    material.opacity = Math.max(0, opacity)
    material.emissiveIntensity = 1.0 + severity * 1.5 * (1 - age)
  })

  return (
    <mesh
      ref={meshRef}
      position={midpoint}
      quaternion={quaternion}
      material={material}
    >
      <cylinderGeometry args={[radius, radius, length, 8]} />
    </mesh>
  )
}

export default React.memo(Beam)