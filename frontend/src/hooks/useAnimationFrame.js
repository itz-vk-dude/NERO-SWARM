/**
 * hooks/useAnimationFrame.js — Animation helper
 * Prevents animation logic from polluting component bodies.
 * Used for orbit math, pulse timers, etc.
 */

import { useRef, useEffect } from 'react'

/**
 * Calls callback(deltaTime) every animation frame.
 * deltaTime is seconds since last frame (capped at 0.1s to prevent spiral-of-death).
 */
export function useAnimationFrame(callback) {
  const callbackRef = useRef(callback)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)

  // Keep callback ref fresh without re-creating the effect
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const loop = (timestamp) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp
      }
      const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = timestamp
      callbackRef.current(delta)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])
}