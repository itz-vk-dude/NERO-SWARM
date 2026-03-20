/**
 * components/AgentNode.jsx — Individual Agent Node (Phase 5 upgrade)
 *
 * Phase 5 adds:
 *   - Click → setSelectedAgent() → triggers AgentInspector panel
 *   - Hover scale ramp (smooth lerp, no state updates per frame)
 *   - Pointer cursor on hover
 */

import React, { useRef, useMemo, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useSwarmStore } from '../state/swarmStore'

function AgentNode({ position, agentName, color, isActive, trustLevel = 0.7, hasError = false }) {
  const meshRef    = useRef()
  const ringRef    = useRef()
  const timeRef    = useRef(Math.random() * 10)

  const currentEmissive = useRef(0.3)
  const currentScale    = useRef(1.0)
  const hoverScale      = useRef(0.0)  // 0 = not hovered, 1 = fully hovered

  const [hovered, setHovered] = useState(false)

  const selectedAgent  = useSwarmStore((s) => s.selectedAgent)
  const setSelected    = useSwarmStore((s) => s.setSelectedAgent)
  const isSelected     = selectedAgent === agentName

  const { gl } = useThree()

  const baseColor    = hasError ? '#ff3864' : color
  const emissiveColor = hasError ? '#ff1040' : color

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.3),
    emissive: new THREE.Color(emissiveColor),
    emissiveIntensity: 0.3,
    roughness: 0.2,
    metalness: 0.9,
    transparent: true,
    opacity: 0.95,
  }), [baseColor, emissiveColor])

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    setSelected(agentName)
  }, [agentName, setSelected])

  const handlePointerOver = useCallback((e) => {
    e.stopPropagation()
    setHovered(true)
    gl.domElement.style.cursor = 'pointer'
  }, [gl])

  const handlePointerOut = useCallback(() => {
    setHovered(false)
    gl.domElement.style.cursor = 'default'
  }, [gl])

  useFrame((state, delta) => {
    timeRef.current += delta
    const t = timeRef.current

    // ── Target emissive ───────────────────────────────────────
    let targetEmissive
    if (hasError) {
      targetEmissive = 0.2 + Math.sin(t * 8) * 0.15
    } else if (isSelected) {
      targetEmissive = 1.0 + trustLevel * 0.5 + Math.sin(t * 2) * 0.1
    } else if (isActive) {
      targetEmissive = 0.8 + trustLevel * 0.6 + Math.sin(t * 3) * 0.15
    } else {
      targetEmissive = 0.15 + trustLevel * 0.35
    }

    currentEmissive.current = THREE.MathUtils.lerp(
      currentEmissive.current, targetEmissive, delta * 3.0
    )
    material.emissiveIntensity = currentEmissive.current

    // ── Hover scale lerp ──────────────────────────────────────
    hoverScale.current = THREE.MathUtils.lerp(
      hoverScale.current, hovered ? 1 : 0, delta * 8
    )

    const baseTargetScale = isActive ? 1.25 : hasError ? 0.85 : 1.0
    const hoverBoost = hoverScale.current * 0.15
    const selectedBoost = isSelected ? 0.12 : 0

    currentScale.current = THREE.MathUtils.lerp(
      currentScale.current,
      baseTargetScale + hoverBoost + selectedBoost,
      delta * 4.0
    )

    if (meshRef.current) {
      meshRef.current.scale.setScalar(currentScale.current)
    }

    // ── Ring visibility ───────────────────────────────────────
    if (ringRef.current) {
      const targetOpacity = isSelected ? 0.9 : isActive ? 0.6 + Math.sin(t * 2) * 0.2 : hovered ? 0.4 : 0.15
      ringRef.current.material.opacity = THREE.MathUtils.lerp(
        ringRef.current.material.opacity, targetOpacity, delta * 5
      )
    }
  })

  return (
    <group position={position}>
      {/* Click + hover target — invisible large sphere */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.65, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Visual sphere */}
      <mesh ref={meshRef} material={material}>
        <sphereGeometry args={[0.35, 32, 32]} />
      </mesh>

      {/* Orbit ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.52, 0.008, 8, 64]} />
        <meshStandardMaterial
          color={emissiveColor}
          emissive={emissiveColor}
          emissiveIntensity={0.8}
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.65, 0.005, 8, 64]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.2}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Label */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, 0.65, 0]}
          fontSize={0.13}
          color={isActive || isSelected ? color : '#3a6a7a'}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.08}
        >
          {agentName.toUpperCase()}
        </Text>
        <Text
          position={[0, 0.48, 0]}
          fontSize={0.085}
          color={isSelected ? '#6abacc' : isActive ? '#ffffff66' : '#1a3a4a'}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.04}
        >
          {`${Math.round(trustLevel * 100)}%`}
        </Text>
      </Billboard>
    </group>
  )
}

export default React.memo(AgentNode)