/**
 * scene/CameraController.jsx — Intentional Camera Movement
 * Controlled zoom, slow auto-rotation, no pan.
 * Visitors feel like observers, not pilots.
 */

import React, { useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

export default function CameraController() {
  const controlsRef = useRef()

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      enableRotate={true}
      autoRotate={true}
      autoRotateSpeed={0.4}        // very slow — contemplative
      minDistance={6}
      maxDistance={22}
      minPolarAngle={Math.PI / 6}  // 30° — don't look from directly above
      maxPolarAngle={Math.PI / 1.8} // don't go below horizon
      dampingFactor={0.05}
      enableDamping={true}
      rotateSpeed={0.5}
    />
  )
}