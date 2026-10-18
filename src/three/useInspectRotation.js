import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

export function useInspectRotation(carousel, platform, slotIndex) {
  const canvas = useThree(s => s.gl.domElement)
  const state = useRef({ pitch: 0, yaw: 0, vx: 0, vy: 0, pointer: null, until: 0 }).current
  const active = () => {
    const selected = carousel.loopMode === 'seamless'
      ? carousel.virtualSelected?.[platform] ?? carousel.selected[platform]
      : carousel.selected[platform]
    return carousel.drawerOpen && carousel.platform === platform && selected === slotIndex
  }
  const release = () => {
    if (state.pointer === null) return
    const pointer = state.pointer
    state.pointer = null
    state.until = performance.now() + 2000
    if (state.target?.hasPointerCapture(pointer)) state.target.releasePointerCapture(pointer)
    state.target = null
    document.body.style.cursor = 'auto'
  }
  useEffect(() => {
    const key = e => {
      if (!active() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Home') state.until = 0
      else {
        state.yaw += e.key === 'ArrowLeft' ? -.12 : e.key === 'ArrowRight' ? .12 : 0
        state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch + (e.key === 'ArrowUp' ? -.12 : e.key === 'ArrowDown' ? .12 : 0)))
        state.until = performance.now() + 2000
      }
      state.vx = state.vy = 0
    }
    canvas.addEventListener('keydown', key)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    return () => {
      release()
      canvas.removeEventListener('keydown', key)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
    }
  }, [canvas, carousel, platform, slotIndex])
  return {
    dragging: () => state.pointer !== null,
    step(dt) {
      if (!active()) {
        release()
        state.until = 0
      }
      if (state.pointer === null && performance.now() >= state.until) {
        // Critically damped analytic spring, stable even after a suspended tab.
        const decay = Math.exp(-9 * dt)
        for (const [axis, velocity] of [['pitch', 'vx'], ['yaw', 'vy']]) {
          const c = state[velocity] + 9 * state[axis]
          state[axis] = (state[axis] + c * dt) * decay
          state[velocity] = (state[velocity] - 9 * c * dt) * decay
        }
      }
      if (active() && carousel.studioSweep && state.pointer === null && performance.now() >= state.until) {
        return { pitch: Math.sin(performance.now() * .0005) * .22, yaw: Math.sin(performance.now() * .0007) * .65 }
      }
      return state
    },
    events: {
      onPointerDown(e) {
        if (!active() || e.button !== 0 || state.pointer !== null) return
        e.stopPropagation()
        state.pointer = e.pointerId
        state.target = e.target
        state.x = e.clientX; state.y = e.clientY
        state.vx = state.vy = 0
        e.target.setPointerCapture(e.pointerId)
        canvas.tabIndex = 0
        canvas.setAttribute('aria-label', 'Cartridge preview. Drag or use arrow keys to rotate. Home returns to the default pose.')
        canvas.focus({ preventScroll: true })
        document.body.style.cursor = 'grabbing'
      },
      onPointerMove(e) {
        if (state.pointer !== e.pointerId) return
        e.stopPropagation()
        const sensitivity = 5 / Math.max(300, canvas.clientHeight)
        state.yaw += (e.clientX - state.x) * sensitivity
        state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch + (e.clientY - state.y) * sensitivity))
        state.x = e.clientX; state.y = e.clientY
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
    },
  }
}
