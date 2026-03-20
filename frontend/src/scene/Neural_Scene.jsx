/**
 * scene/Neural_Scene.jsx — 3D Neural Scene Container
 *
 * The Canvas. The world. Everything 3D lives inside here.
 * Reads swarmStore for global state.
 * Composes: Lighting, CameraController, CoreNode, OrbitSystem, BeamManager, PostFX.
 */

import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Vector2 } from 'three'
import Lighting from './Lighting'
import CameraController from './CameraController'
import CoreNode from '../components/CoreNode'
import OrbitSystem from '../components/OrbitSystem'
import BeamManager from '../components/BeamManager'
import { useSwarmStore } from '../state/swarmStore'

function SceneContents() {
  const swarmStatus = useSwarmStore((s) => s.swarmStatus)
  const consensusConfidence = useSwarmStore((s) => s.consensusConfidence)
  const divergence = useSwarmStore((s) => s.divergence)

  return (
    <>
      <Lighting />
      <CameraController />
      <CoreNode
        confidence={consensusConfidence}
        divergence={divergence}
        swarmStatus={swarmStatus}
      />
      <OrbitSystem />
      <BeamManager />

      {/* Subtle grid floor */}
      <gridHelper
        args={[40, 40, '#001a2e', '#001020']}
        position={[0, -3.5, 0]}
        rotation={[0, 0, 0]}
      />

      {/* Post-processing effects */}
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new Vector2(0.0005, 0.0005)}
        />
      </EffectComposer>
    </>
  )
}

export default function NeuralScene() {
  return (
    <Canvas
      camera={{ position: [0, 5, 14], fov: 55 }}
      gl={{
        antialias: true,
        toneMapping: 4, // ACESFilmic
        toneMappingExposure: 1.2,
      }}
      style={{ background: '#020408' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#020408']} />
      <fog attach="fog" args={['#020408', 18, 45]} />
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
    </Canvas>
  )
}