'use client'

import { useEffect, useMemo, useState } from 'react'
import { Leva, useControls, useCreateStore } from 'leva'
import { INSPECT, LABEL_FIT } from './inspectState'

const DEFAULTS = {
  orbit: true,
  autoRotate: false,
  freeze: true,
  wireframe: false,
  checker: false,
  artZoom: 1,
  repeatX: 1,
  repeatY: 1,
  offsetX: 0,
  offsetY: 0,
}

const hud = {
  position: 'fixed',
  left: 12,
  bottom: 12,
  zIndex: 40,
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(10, 10, 12, 0.82)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  color: '#e8e8ea',
  font: '11px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace',
  letterSpacing: '0.02em',
  pointerEvents: 'none',
  whiteSpace: 'pre',
}

/**
 * DOM side of the inspect mode: a Leva panel plus a small readout of the exact
 * numbers that decide whether the label is stretched.
 *
 * Only mounted when the page is opened with ?inspect, so the live showcase is
 * untouched.
 */
export function InspectPanel({ label, faceAspect, tabV = 0 }) {
  const store = useCreateStore()
  const [textureAspect, setTextureAspect] = useState(null)

  // The face only samples the front art, not the tab, so the aspect to judge
  // stretch against is the front region, not the whole sheet.
  const contentAspect = textureAspect ? textureAspect / (1 - tabV) : null

  const [values, set] = useControls(
    () => ({
      orbit: { value: DEFAULTS.orbit, label: 'orbit' },
      autoRotate: { value: DEFAULTS.autoRotate, label: 'auto-rotate' },
      freeze: { value: DEFAULTS.freeze, label: 'freeze motion' },
      wireframe: { value: DEFAULTS.wireframe, label: 'wireframe' },
      checker: { value: DEFAULTS.checker, label: 'checker map' },
      artZoom: { value: DEFAULTS.artZoom, min: 0.5, max: 3, step: 0.01, label: 'art zoom' },
      repeatX: { value: DEFAULTS.repeatX, min: 0.2, max: 1, step: 0.001, label: 'repeat X' },
      repeatY: { value: DEFAULTS.repeatY, min: 0.2, max: 1, step: 0.001, label: 'repeat Y' },
      offsetX: { value: DEFAULTS.offsetX, min: -0.5, max: 0.5, step: 0.001, label: 'offset X' },
      offsetY: { value: DEFAULTS.offsetY, min: -0.5, max: 0.5, step: 0.001, label: 'offset Y' },
      noStretch: { value: false, label: 'fit no-stretch' },
      center: { value: false, label: 'center art' },
      reset: { value: false, label: 'reset all' },
    }),
    { store },
  )

  useEffect(() => {
    INSPECT.active = true
    return () => {
      INSPECT.active = false
    }
  }, [])

  // Inspect mode only: let a test drive the real Leva values.
  useEffect(() => {
    window.__cartridgeInspect = { ...(window.__cartridgeInspect || {}), set }
    return () => {
      if (window.__cartridgeInspect?.set === set) delete window.__cartridgeInspect.set
    }
  }, [set])

  useEffect(() => {
    let alive = true
    const image = new Image()
    image.onload = () => {
      if (!alive) return
      setTextureAspect(image.naturalWidth / image.naturalHeight)
    }
    image.src = label
    return () => {
      alive = false
    }
  }, [label, tabV, faceAspect, set])

  useEffect(() => {
    INSPECT.orbit = values.orbit
    INSPECT.autoRotate = values.autoRotate
    INSPECT.freeze = values.freeze
    INSPECT.wireframe = values.wireframe
    INSPECT.checker = values.checker
    // Art zoom magnifies the label texture itself: it shrinks the sampled
    // region around its own centre, so the art gets bigger without changing
    // its shape and without moving the camera.
    const zoom = values.artZoom
    const effX = values.repeatX / zoom
    const effY = values.repeatY / zoom
    const centerX = values.offsetX + values.repeatX / 2
    const centerY = values.offsetY + values.repeatY / 2
    LABEL_FIT.repeat.set(effX, effY)
    LABEL_FIT.offset.set(centerX - effX / 2, centerY - effY / 2)
  }, [values])

  // Fit presets are one-shot: apply, then flip the switch back off.
  useEffect(() => {
    if (values.noStretch && contentAspect) {
      const ratio = faceAspect / contentAspect
      let repeatX = 1
      let repeatY = ratio
      if (repeatY > 1) {
        repeatY = 1
        repeatX = 1 / ratio
      }
      set({ repeatX, repeatY, offsetX: (1 - repeatX) / 2, offsetY: (1 - repeatY) / 2, noStretch: false })
    }
  }, [values.noStretch, contentAspect, faceAspect, set])

  useEffect(() => {
    if (values.center) {
      set({ offsetX: (1 - values.repeatX) / 2, offsetY: (1 - values.repeatY) / 2, center: false })
    }
  }, [values.center, values.repeatX, values.repeatY, set])

  useEffect(() => {
    if (values.reset) {
      set({ ...DEFAULTS, noStretch: false, center: false, reset: false })
    }
  }, [values.reset, set])

  const stretch = useMemo(() => {
    if (!contentAspect) return null
    const visible = contentAspect * (values.repeatY / values.repeatX)
    return faceAspect / visible
  }, [contentAspect, values.repeatX, values.repeatY, faceAspect])

  const stretchLabel = stretch == null
    ? 'measuring...'
    : `${stretch.toFixed(3)}x  ${stretch >= 1 ? '+' : ''}${((stretch - 1) * 100).toFixed(1)}% ${stretch > 1.001 ? 'too wide' : stretch < 0.999 ? 'too tall' : 'correct'}`

  const effX = values.repeatX / values.artZoom
  const effY = values.repeatY / values.artZoom
  const effOffX = values.offsetX + values.repeatX / 2 - effX / 2
  const effOffY = values.offsetY + values.repeatY / 2 - effY / 2

  const contentLabel = contentAspect ? contentAspect.toFixed(4) : '?'
  const lines = [
    `art aspect ${contentLabel} (front region, tab excluded)`,
    `face     ${faceAspect.toFixed(4)} aspect`,
    `stretch   ${stretchLabel}`,
    `art zoom  ${values.artZoom.toFixed(2)}x`,
    `repeat    ${effX.toFixed(3)} x ${effY.toFixed(3)}`,
    `offset    ${effOffX.toFixed(3)} x ${effOffY.toFixed(3)}`,
    '',
    'art zoom scales the label, not the camera',
    'drag to orbit the cart, scroll to move closer',
    'leva panel is top right',
  ]

  return (
    <>
      <Leva
        store={store}
        collapsed
        oneLineLabels
        titleBar={{ title: 'Cartridge inspect', drag: true }}
      />
      <div style={hud}>{lines.join('\n')}</div>
    </>
  )
}