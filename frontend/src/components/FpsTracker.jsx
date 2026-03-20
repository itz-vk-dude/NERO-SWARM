/**
 * components/FpsTracker.jsx — FPS Monitor (Canvas-internal)
 *
 * Lives inside the R3F Canvas so it can use useFrame.
 * Reports FPS to swarmStore every ~30 frames.
 * Zero visual output — pure instrumentation.
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSwarmStore } from '../state/swarmStore'

const SAMPLE_EVERY = 30

export default function FpsTracker() {
  const frameCount = useRef(0)
  const lastTime   = useRef(performance.now())
  const setFps     = useSwarmStore((s) => s.setFps)

  useFrame(() => {
    frameCount.current++
    if (frameCount.current >= SAMPLE_EVERY) {
      const now     = performance.now()
      const elapsed = (now - lastTime.current) / 1000
      const fps     = SAMPLE_EVERY / elapsed
      setFps(fps)
      frameCount.current = 0
      lastTime.current   = now
    }
  })

  return null
}