/**
 * Cosmos ring of cartridges.
 *
 * Built on the Panoply cartridge code: model normalisation (prepareModel),
 * shell and label materials (configureShellMaterial, labelFinishParameters),
 * texture upload pacing (TextureWarmup, useLabelTexture) and the studio light
 * rig (SceneLighting) all come from ./Scene.jsx. What is new here is the
 * layout: the cartridges orbit a tilted ring, the front one is selected, and
 * each arrives with a fade and scale once its model and label are ready.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Stars, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  configureShellMaterial,
  labelFinishParameters,
  prepareModel,
  SceneLighting,
  TextureWarmup,
  useLabelTexture,
} from './Scene.jsx'
import { MODELS, PLATFORM_ORDER, PLATFORM_NAMES, FAVORITE_TITLES, RING_SIZE, buildRing } from '../data/cartridgeModels.js'
import { labelArt } from '../lib/labelArt'

const RING_RADIUS = 3.7
const RING_TILT = 0.32
const STEP = (Math.PI * 2) / RING_SIZE
const FADE_SECONDS = 0.9
const FADE_STAGGER = 0.06
const BACKGROUND = '#07080a'
const CAMERA_POSITION = [0, 1.0, 13.4]
const CAMERA_TARGET = [0, -0.15, 0]
const LIGHT_STATE = { pose: 'default' }
const WHEEL_THRESHOLD = 40
const WHEEL_COOLDOWN_MS = 260

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

function RingCartridge({ cart, index, motion, textureQueue, art, onReady }) {
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
      cart.finish,
      cart.casing,
    ),
    [shellTextures, cart.casing, cart.finish],
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

  useFrame((state, delta) => {
    const node = group.current
    if (!node) return
    const time = state.clock.elapsedTime
    const angle = motion.angle + index * STEP
    const front = (Math.cos(angle) + 1) / 2
    const sway = Math.sin(time * 0.7 + cart.phase)

    node.position.set(
      RING_RADIUS * Math.sin(angle),
      -RING_RADIUS * Math.sin(RING_TILT) * Math.cos(angle) + 0.12 * sway,
      RING_RADIUS * Math.cos(angle) * Math.cos(RING_TILT),
    )
    node.rotation.set(-0.04 + 0.03 * sway, (config.faceRotation ?? Math.PI) + angle, 0.025 * Math.cos(time * 0.6 + cart.phase))

    if (!readyRef.current) {
      node.visible = false
      return
    }
    if (startRef.current === null) startRef.current = time + index * FADE_STAGGER
    const t = THREE.MathUtils.clamp((time - startRef.current) / FADE_SECONDS, 0, 1)
    const eased = easeOutCubic(t)
    node.visible = t > 0
    fadeList.forEach((material) => {
      material.opacity = (material.userData.panoplyBaseOpacity ?? 1) * eased
      material.transparent = t < 1 ? true : Boolean(material.userData.panoplyBaseTransparent)
    })
    const base = 0.46 + 0.56 * Math.pow(front, 1.6)
    node.scale.setScalar(base * (0.92 + 0.08 * easeOutBack(t)))
  })

  return (
    <group ref={group} visible={false}>
      <group scale={1}>
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
    </group>
  )
}

function MotionDriver({ motion }) {
  useFrame((_, delta) => {
    const lambda = motion.dragging ? 18 : 6.5
    motion.angle = THREE.MathUtils.damp(motion.angle, motion.target, lambda, Math.min(delta, 1 / 30))
  })
  return null
}

function SelectionWatcher({ motion, count, onSelect }) {
  const last = useRef(-1)
  useFrame(() => {
    const selected = ((-Math.round(motion.target / STEP)) % count + count) % count
    if (selected !== last.current) {
      last.current = selected
      onSelect?.(selected)
    }
  })
  return null
}

// Keep the whole ring in view on narrow screens by pulling the camera back.
function FitCamera() {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1)
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
    const needed = (RING_RADIUS + 1.4) / (Math.tan(halfFov) * Math.max(aspect, 0.2))
    camera.position.set(CAMERA_POSITION[0], CAMERA_POSITION[1], Math.max(CAMERA_POSITION[2], needed))
    camera.lookAt(...CAMERA_TARGET)
  }, [camera, size.width, size.height])
  return null
}
function RingEnvironment() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  useEffect(() => {
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

function OrbitLine() {
  const geometry = useMemo(() => {
    const points = []
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2
      points.push(new THREE.Vector3(
        RING_RADIUS * Math.sin(a),
        -RING_RADIUS * Math.sin(RING_TILT) * Math.cos(a),
        RING_RADIUS * Math.cos(a) * Math.cos(RING_TILT),
      ))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#7f8aa3" transparent opacity={0.16} />
    </line>
  )
}

export default function CartridgeRing({ carts, controlRef, onSelect, onProgress }) {
  const motion = useRef({ angle: 0, target: 0, dragging: false })
  const queue = useRef([])
  const drag = useRef(null)
  const wheel = useRef({ accumulated: 0, last: -Infinity })
  const container = useRef(null)
  const loadedRef = useRef(0)
  const onReady = useCallback(() => {
    loadedRef.current += 1
    if (container.current) container.current.dataset.loaded = String(loadedRef.current)
    onProgress?.(loadedRef.current)
  }, [onProgress])
  const [art, setArt] = useState({})

  const step = (direction) => {
    const snapped = Math.round(motion.current.target / STEP)
    motion.current.target = (snapped - direction) * STEP
  }

  useEffect(() => {
    if (!controlRef) return
    controlRef.current = { step }
    return () => {
      controlRef.current = null
    }
  }, [controlRef])

  // Real box art, one title at a time, politely paced. The generated label
  // stays on screen until (and unless) a real cover resolves.
  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const cart of carts) {
        if (!alive) return
        try {
          const response = await fetch(`/api/cover?title=${encodeURIComponent(cart.title)}`)
          const data = await response.json()
          if (alive && data.url) setArt((current) => ({ ...current, [cart.id]: data.url }))
        } catch {
          // Keep the generated label.
        }
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }
    })()
    return () => {
      alive = false
    }
  }, [carts])

  useEffect(() => {
    const element = container.current
    if (!element) return
    const onWheel = (event) => {
      event.preventDefault()
      const state = wheel.current
      state.accumulated += event.deltaY
      const now = performance.now()
      if (now - state.last < WHEEL_COOLDOWN_MS || Math.abs(state.accumulated) < WHEEL_THRESHOLD) return
      step(Math.sign(state.accumulated))
      state.accumulated = 0
      state.last = now
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: motion.current.target, moved: false }
  }
  const onPointerMove = (event) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    if (!state.moved && Math.hypot(dx, dy) < 6) return
    state.moved = true
    motion.current.dragging = true
    motion.current.target = state.start + (dy - dx) * 0.0065
  }
  const endDrag = (event) => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    if (state.moved) motion.current.target = Math.round(motion.current.target / STEP) * STEP
    motion.current.dragging = false
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    }
  }

  return (
    <div
      ref={container}
      className="ring-stage"
      role="application"
      tabIndex={0}
      aria-label="Cartridge ring. Drag, scroll, or use the arrow keys to browse."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={onKeyDown}
    >
      <Canvas
        frameloop="always"
        dpr={[1, 1.6]}
        camera={{ position: CAMERA_POSITION, fov: 30, near: 0.1, far: 60 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.8,
        }}
        onCreated={({ camera, scene }) => {
          camera.lookAt(...CAMERA_TARGET)
          scene.fog = new THREE.Fog(BACKGROUND, 11, 24)
        }}
      >
        <FitCamera />
        <RingEnvironment />
        <SceneLighting carousel={LIGHT_STATE} />
        <Stars radius={60} depth={40} count={900} factor={2.2} saturation={0} fade speed={0.25} />
        <OrbitLine />
        <TextureWarmup queue={queue.current} />
        <MotionDriver motion={motion.current} />
        <SelectionWatcher motion={motion.current} count={carts.length} onSelect={onSelect} />
        {carts.map((cart, index) => (
          <RingCartridge
            key={cart.id}
            cart={cart}
            index={index}
            motion={motion.current}
            textureQueue={queue.current}
            art={art[cart.id] || labelArt(cart.title, cart.platformName)}
            onReady={onReady}
          />
        ))}
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.28} luminanceThreshold={0.9} luminanceSmoothing={0.2} radius={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
