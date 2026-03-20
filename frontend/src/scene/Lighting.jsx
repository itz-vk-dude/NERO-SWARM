/**
 * scene/Lighting.jsx — Neural Scene Lighting
 * Futuristic lab feel: deep ambient, cool directional, cyan rim.
 * No rainbow. No harsh shadows. Just cold intelligence.
 */

import React from 'react'

export default function Lighting() {
  return (
    <>
      {/* Deep ambient — keeps geometry readable without washing out */}
      <ambientLight intensity={0.08} color="#001a2e" />

      {/* Primary cool-white directional */}
      <directionalLight
        position={[10, 20, 10]}
        intensity={0.6}
        color="#a0d8ef"
        castShadow={false}
      />

      {/* Cyan rim light — the signature neural glow */}
      <pointLight
        position={[-8, 4, -8]}
        intensity={2.5}
        color="#00e5ff"
        distance={30}
        decay={2}
      />

      {/* Subtle warm fill from below — prevents pure black undersides */}
      <pointLight
        position={[0, -10, 0]}
        intensity={0.4}
        color="#0a1628"
        distance={20}
        decay={2}
      />

      {/* Core accent — intensifies around center */}
      <pointLight
        position={[0, 0, 0]}
        intensity={1.0}
        color="#0066ff"
        distance={8}
        decay={2}
      />
    </>
  )
}