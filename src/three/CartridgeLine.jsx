/**
 * Staggered cartridge lineup.
 *
 * Built on the Panoply cartridge code: model normalisation (prepareModel),
 * shell and label materials (configureShellMaterial, labelFinishParameters),
 * texture upload pacing (TextureWarmup, useLabelTexture) and the studio light
 * rig (SceneLighting) all come from ./Scene.jsx. What is new here is the
 * layout: the cartridges sit in a staggered line that drifts sideways on its
 * own, the one nearest the centre is selected, and each arrives with a fade
 * once its model and label are ready.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from './roomEnvironment'
import {
  configureShellMaterial,
  labelFinishParameters,
  prepareModel,
  SceneLighting,
  TextureWarmup,
  useLabelTexture,
} from './Scene.jsx'
import { MODELS, LINEUP_SIZE, LABEL_ASPECT } from '../data/cartridgeModels.js'
import { labelArt } from '../lib/labelArt'

const SPACING = 3.05
const ROW_LIFT = 0.3
// Lifts the whole line so the centred cartridge clears the caption row.
const LINE_LIFT = 0.28
const DEPTH_STEP = 1
// Panoply's own framing: the centred cartridge fills the middle of the screen
// and its neighbours sit at the edges. Narrow windows pull the whole line in
// rather than letting the cartridges collide.
const CENTER_SCALE = 1.05
const SIDE_SCALE = 0.88
const MIN_FIT = 0.6
// How long the line rests on a cartridge before stepping to the next one.
const HOLD_SECONDS = 2.6
// Longest slice of time a single frame may advance the drift. Caps the jump
// after a stall without making the pace depend on the frame rate.
const MAX_FRAME_STEP = 0.25
const FADE_SECONDS = 0.9
const FADE_STAGGER = 0.06
const BACKGROUND = '#07080a'
const CAMERA_POSITION = [0, 0.15, 7.4]
const CAMERA_TARGET = [0, 0.15, 0]
const LIGHT_STATE = { pose: 'default' }

const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3)
const easeOutBack = (p) => 1 + 2.1 * Math.pow(p - 1, 3) + 1.1 * Math.pow(p - 1, 2)

// Normalised models are shared per system; textures upload a few per frame.
const uploadedTextures = new WeakSet()
const preparedModels = new Map()

function queueUpload(texture, queue) {
  if (uploadedTextures.has(texture)) return
  uploadedTextures.add(texture)
  queue.push((gl) => gl.initTexture(texture))
}

function useModelBundle(platform, textureQueue) {
  const config = MODELS[platform]
  const { scene } = useGLTF(config.url)
  const entries = useMemo(() => Object.entries(config.shellMaps || {}), [config])
  const textures = useLoader(THREE.TextureLoader, entries.map(([, url]) => url))

  useLayoutEffect(() => {
    entries.forEach(([name], index) => {
      const texture = textures[index]
      texture.flipY = false
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.colorSpace = name === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.userData.panoplyRGNormal = name === 'normalMap'
      texture.anisotropy = 8
      texture.needsUpdate = true
      queueUpload(texture, textureQueue)
    })
  }, [entries, textures, textureQueue])

  return useMemo(() => {
    const shellTextures = Object.fromEntries(entries.map(([name], index) => [name, textures[index]]))
    let prepared = preparedModels.get(platform)
    if (!prepared || prepared.scene !== scene) {
      prepared = { scene, ...prepareModel(scene, config, {}) }
      preparedModels.set(platform, prepared)
    }
    return { prepared, shellTextures }
  }, [platform, scene, config, entries, textures])
}

function LineCartridge({ cart, index, motion, textureQueue, art, onReady }) {
  const config = MODELS[cart.platform]
  const { prepared, shellTextures } = useModelBundle(cart.platform, textureQueue)
  const label = useLabelTexture(art, null, textureQueue)
  const group = useRef(null)
  const readyRef = useRef(false)
  const startRef = useRef(null)

  const labelMaterial = useMemo(() => {
    const finish = labelFinishParameters('default')
    return new THREE.MeshPhysicalMaterial({
      roughness: finish.roughness,
      metalness: finish.metalness,
      clearcoat: finish.clearcoat,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    })
  }, [])

  useEffect(() => {
    labelMaterial.map = label
    labelMaterial.needsUpdate = true
    readyRef.current = Boolean(label)
    if (label) onReady?.()
  }, [label, labelMaterial, onReady])

  const shellMaterial = useMemo(
    () => configureShellMaterial(
      new THREE.MeshPhysicalMaterial({ ...shellTextures, color: cart.casing || '#ffffff' }),
      'default',
      cart.casing,
    ),
    [shellTextures, cart.casing],
  )

  const innerMaterial = useMemo(() => {
    const hasInner = prepared.parts.some((part) => part.roles.includes('inner'))
    if (!hasInner || config.preserveInnerMaterials) return null
    return new THREE.MeshPhysicalMaterial({
      ...shellTextures,
      color: '#ffffff',
      roughness: 0.72,
      metalness: 0.06,
      clearcoat: 0.1,
      clearcoatRoughness: 0.42,
    })
  }, [prepared, shellTextures, config])

  const resolved = useMemo(() => prepared.parts.map((part) => {
    const materials = part.materials.map((material, i) => {
      const role = part.roles[i]
      if (role === 'label') return labelMaterial
      if (role === 'shell') return shellMaterial
      if (role === 'inner' && innerMaterial) return innerMaterial
      return material.clone()
    })
    return part.materialArray ? materials : materials[0]
  }), [prepared, labelMaterial, shellMaterial, innerMaterial])

  const fadeList = useMemo(() => {
    const list = [labelMaterial, shellMaterial, innerMaterial].filter(Boolean)
    resolved.forEach((entry) => {
      ;(Array.isArray(entry) ? entry : [entry]).forEach((material) => {
        if (!list.includes(material)) list.push(material)
      })
    })
    return list
  }, [resolved, labelMaterial, shellMaterial, innerMaterial])

  // Remember each material's own opacity so hidden and glass parts keep theirs.
  useLayoutEffect(() => {
    fadeList.forEach((material) => {
      if (material.userData.panoplyBaseOpacity === undefined) {
        material.userData.panoplyBaseOpacity = material.opacity
        material.userData.panoplyBaseTransparent = material.transparent
      }
      material.opacity = 0
      material.transparent = true
    })
  }, [fadeList])

  useEffect(() => () => fadeList.forEach((material) => material.dispose()), [fadeList])

  useFrame((state) => {
    const node = group.current
    if (!node) return
    const time = state.clock.elapsedTime

    // Wrap the cartridge through an infinite line: `u` is its distance from
    // the centre measured in slots, wrapped into (-count/2, count/2].
    const phase = motion.drift / SPACING
    let u = index - phase
    u = ((u % LINEUP_SIZE) + LINEUP_SIZE) % LINEUP_SIZE
    if (u > LINEUP_SIZE / 2) u -= LINEUP_SIZE

    // How centred the cartridge is: 1 in the middle, 0 a slot away.
    const centred = Math.max(0, 1 - Math.abs(u))
    // Panoply's framing: the line scales down with the window's proportions so
    // a phone shows the centred cartridge large instead of a row of minis.
    const fit = THREE.MathUtils.clamp(state.camera.aspect / (16 / 9), MIN_FIT, 1)

    node.position.set(
      u * SPACING,
      LINE_LIFT + cart.row * ROW_LIFT + cart.lift + 0.05 * Math.sin(time * 0.5 + cart.phase) + 0.1 * centred,
      cart.depth * DEPTH_STEP + 0.5 * centred,
    )
    node.rotation.set(
      -0.03 + 0.02 * Math.sin(time * 0.4 + cart.phase),
      (config.faceRotation ?? Math.PI) + cart.tilt - 0.05 * u,
      0.02 * Math.cos(time * 0.45 + cart.phase),
    )

    if (!readyRef.current) {
      node.visible = false
      return
    }
    if (startRef.current === null) startRef.current = time + index * FADE_STAGGER
    const t = THREE.MathUtils.clamp((time - startRef.current) / FADE_SECONDS, 0, 1)
    node.visible = t > 0
    fadeList.forEach((material) => {
      material.opacity = (material.userData.panoplyBaseOpacity ?? 1) * easeOutCubic(t)
      material.transparent = t < 1 ? true : Boolean(material.userData.panoplyBaseTransparent)
    })
    const scale = (SIDE_SCALE + (CENTER_SCALE - SIDE_SCALE) * centred) * fit
    node.scale.setScalar(scale * (0.94 + 0.06 * easeOutBack(t)))
  })

  return (
    <group ref={group} visible={false}>
      <group rotation={config.rotation || [0, 0, 0]}>
        <group position={prepared.modelOffset}>
          <group scale={prepared.normScale}>
            {prepared.parts.map((part, partIndex) => (
              <mesh
                key={partIndex}
                geometry={part.geometry}
                material={resolved[partIndex]}
                matrix={part.matrix}
                matrixAutoUpdate={false}
                dispose={null}
              />
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

// The idle motion: the line advances one cartridge at a time, pausing between
// steps, and settles each one in the centre. It keeps moving on its own until a
// drag takes over. Real elapsed time is used (capped, so a long stall cannot
// jump the line), which keeps the cadence the same at 60fps and at 5fps.
function DriftDriver({ motion }) {
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_FRAME_STEP)
    if (motion.settling) {
      motion.drift = THREE.MathUtils.damp(motion.drift, motion.target, 5.5, step)
      if (Math.abs(motion.drift - motion.target) < 0.01) {
        motion.drift = motion.target
        motion.settling = false
        motion.hold = HOLD_SECONDS
      }
      return
    }
    if (motion.dragging) return
    // Reduced motion: the line only moves when it is asked to.
    if (!motion.auto) return
    motion.hold -= step
    if (motion.hold > 0) return
    motion.target = Math.round(motion.drift / SPACING) * SPACING + SPACING
    motion.settling = true
  })
  return null
}

// The cartridge nearest the centre is the selected one. The index is mirrored
// onto the container as `data-index`, which gives the browser tests a way to
// observe the line without reading pixels.
function SelectionWatcher({ motion, onSelect, onIndex }) {
  const last = useRef(-1)
  useFrame(() => {
    const selected = ((Math.round(motion.drift / SPACING) % LINEUP_SIZE) + LINEUP_SIZE) % LINEUP_SIZE
    if (selected === last.current) return
    last.current = selected
    onIndex?.(selected)
    onSelect?.(selected)
  })
  return null
}

// Cartridges are sized against the viewport height by the camera, so there is
// nothing to rescale per screen width. A narrow screen simply shows fewer of
// them, which is the point of a lineup.

function StudioEnvironment() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  useEffect(() => {
    // The room is pinned to Panoply's copy on purpose: the current three
    // example lights the shells much harder and the plastic blows out.
    const generator = new THREE.PMREMGenerator(gl)
    const environment = generator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environment
    return () => {
      scene.environment = null
      environment.dispose()
      generator.dispose()
    }
  }, [gl, scene])
  return null
}

export default function CartridgeLine({ carts, controlRef, onSelect, onProgress }) {
  // Someone who asked for less motion still gets the line, just not the drift.
  const [auto] = useState(() => typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const motion = useRef({ drift: 0, target: 0, dragging: false, settling: false, hold: HOLD_SECONDS, auto })
  const queue = useRef([])
  const drag = useRef(null)
  const container = useRef(null)
  const loadedRef = useRef(0)
  const onReady = useCallback(() => {
    loadedRef.current += 1
    if (container.current) container.current.dataset.loaded = String(loadedRef.current)
    onProgress?.(loadedRef.current)
  }, [onProgress])

  const onIndex = useCallback((selected) => {
    const node = container.current
    if (node) node.dataset.index = String(selected)
  }, [])

  // A step settles the line onto the next slot instead of teleporting it.
  const step = (direction) => {
    const from = Math.round(motion.current.drift / SPACING)
    motion.current.target = (from + direction) * SPACING
    motion.current.settling = true
    motion.current.hold = HOLD_SECONDS
  }

  useEffect(() => {
    if (!controlRef) return
    controlRef.current = { step }
    return () => {
      controlRef.current = null
    }
  }, [controlRef])

  // Box art ships with the site, so every label resolves from a local file and
  // no cartridge waits on a network round trip. The generated label is only a
  // fallback for a cartridge without cover art.

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX, start: motion.current.drift, moved: false }
  }
  const onPointerMove = (event) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const dx = event.clientX - state.x
    if (!state.moved && Math.abs(dx) < 6) return
    state.moved = true
    motion.current.dragging = true
    motion.current.settling = false
    motion.current.drift = state.start - dx * 0.006
  }
  const endDrag = (event) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    if (state.moved) {
      motion.current.target = Math.round(motion.current.drift / SPACING) * SPACING
      motion.current.settling = true
      motion.current.hold = HOLD_SECONDS
    }
    motion.current.dragging = false
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    }
  }

  return (
    <div
      ref={container}
      className="lineup-stage"
      role="application"
      tabIndex={0}
      aria-label="Cartridge lineup. Drag or use the arrow keys to browse."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={onKeyDown}
    >
      <Canvas
        frameloop="always"
        dpr={[1, 2]}
        camera={{ position: CAMERA_POSITION, fov: 35, near: 0.1, far: 60 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        onCreated={({ camera, scene }) => {
          camera.lookAt(...CAMERA_TARGET)
          // An opaque background in exactly the page colour: the canvas then
          // blends into the page with no visible edge.
          scene.background = new THREE.Color(BACKGROUND)
        }}
      >
        <StudioEnvironment />
        <SceneLighting carousel={LIGHT_STATE} />
        <TextureWarmup queue={queue.current} />
        <DriftDriver motion={motion.current} />
        <SelectionWatcher motion={motion.current} onSelect={onSelect} onIndex={onIndex} />
        {carts.map((cart, index) => (
          <LineCartridge
            key={cart.id}
            cart={cart}
            index={index}
            motion={motion.current}
            textureQueue={queue.current}
            art={cart.cover || labelArt(cart.title, cart.platformName, LABEL_ASPECT[cart.platform])}
            onReady={onReady}
          />
        ))}
      </Canvas>
    </div>
  )
}
