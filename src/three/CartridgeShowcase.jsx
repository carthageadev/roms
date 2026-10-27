import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MODELS } from '../data/cartridgeModels.js'
import { configureShellMaterial, labelFinishParameters, prepareModel, SceneLighting } from './Scene.jsx'
import { RoomEnvironment } from './roomEnvironment.js'

const MODEL = MODELS.gba
const LABEL = '/images/labels/metroid-fusion.png'
const LIGHT_STATE = { pose: 'default' }

// The same studio room used by Panoply, rather than the brighter newer one.
function StudioEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const room = new RoomEnvironment()
    const generator = new THREE.PMREMGenerator(gl)
    const target = generator.fromScene(room, 0.04)
    const previous = scene.environment
    scene.environment = target.texture
    room.dispose()
    generator.dispose()
    return () => {
      if (scene.environment === target.texture) scene.environment = previous
      target.dispose()
    }
  }, [gl, scene])
  return null
}

function Cartridge({ motion, onReady }) {
  const group = useRef(null)
  const { scene } = useGLTF(MODEL.url)
  const entries = useMemo(() => Object.entries(MODEL.shellMaps), [])
  const textures = useLoader(THREE.TextureLoader, [...entries.map(([, url]) => url), LABEL])
  const prepared = useMemo(() => prepareModel(scene, MODEL), [scene])

  useLayoutEffect(() => {
    textures.forEach((texture, index) => {
      const name = entries[index]?.[0]
      texture.flipY = false
      texture.colorSpace = name === 'map' || index === entries.length ? THREE.SRGBColorSpace : THREE.NoColorSpace
      if (index < entries.length) texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.userData.panoplyRGNormal = name === 'normalMap'
      texture.anisotropy = 8
      texture.needsUpdate = true
    })
  }, [entries, textures])

  const materials = useMemo(() => {
    const maps = Object.fromEntries(entries.map(([name], index) => [name, textures[index]]))
    const shell = configureShellMaterial(new THREE.MeshPhysicalMaterial({ ...maps, color: '#ffffff' }), 'default')
    const inner = new THREE.MeshPhysicalMaterial({
      ...maps, color: '#ffffff', roughness: 0.72, metalness: 0.06, clearcoat: 0.1, clearcoatRoughness: 0.42,
    })
    const finish = labelFinishParameters('default')
    const label = new THREE.MeshPhysicalMaterial({
      map: textures[entries.length],
      roughness: finish.roughness,
      metalness: finish.metalness,
      clearcoat: finish.clearcoat,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    })
    const owned = [shell, inner, label]
    const resolved = prepared.parts.map((part) => {
      const choices = part.materials.map((material, i) => {
        if (part.roles[i] === 'shell') return shell
        if (part.roles[i] === 'inner') return inner
        if (part.roles[i] === 'label') return label
        const copy = material.clone()
        owned.push(copy)
        return copy
      })
      return part.materialArray ? choices : choices[0]
    })
    return { resolved, owned }
  }, [entries, prepared, textures])

  useEffect(() => {
    onReady()
    return () => materials.owned.forEach((material) => material.dispose())
  }, [materials, onReady])

  useFrame((state, delta) => {
    const node = group.current
    if (!node) return
    const { x, y, reduced } = motion.current
    const time = state.clock.elapsedTime
    const float = reduced ? 0 : Math.sin(time * 0.75) * 0.022
    const step = Math.min(delta, 0.1)
    // Inputs are bounded; the cartridge tips by only a few degrees, never spins.
    node.position.x = THREE.MathUtils.damp(node.position.x, reduced ? 0 : x * 0.025, 3, step)
    node.position.y = THREE.MathUtils.damp(node.position.y, reduced ? 0 : float + y * 0.018, 3, step)
    node.rotation.x = THREE.MathUtils.damp(node.rotation.x, -0.035 + (reduced ? 0 : y * 0.045), 3, step)
    node.rotation.y = THREE.MathUtils.damp(node.rotation.y, Math.PI + (reduced ? 0 : x * 0.065), 3, step)
    node.rotation.z = THREE.MathUtils.damp(node.rotation.z, reduced ? 0 : -x * 0.012, 3, step)
  })

  return (
    <group ref={group} rotation={[-0.035, Math.PI, 0]}>
      <group rotation={MODEL.rotation}>
        <group position={prepared.modelOffset}>
          <group scale={prepared.normScale}>
            {prepared.parts.map((part, index) => (
              <mesh key={index} geometry={part.geometry} material={materials.resolved[index]}
                matrix={part.matrix} matrixAutoUpdate={false} dispose={null} />
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

const clamp = (value) => Math.max(-1, Math.min(1, value))
const angleDelta = (value, baseline) => ((value - baseline + 540) % 360) - 180

export default function CartridgeShowcase() {
  const motion = useRef({ x: 0, y: 0, reduced: false })
  const stage = useRef(null)
  const orientationBaseline = useRef(null)
  const [ready, setReady] = useState(false)
  const [permission, setPermission] = useState('unavailable')
  const [reduced, setReduced] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => {
      motion.current.reduced = preference.matches
      if (preference.matches) {
        motion.current.x = 0
        motion.current.y = 0
        orientationBaseline.current = null
        if (stage.current) stage.current.dataset.input = 'still'
      }
      setReduced(preference.matches)
    }
    updatePreference()
    preference.addEventListener('change', updatePreference)

    const onPointer = (event) => {
      if (event.pointerType !== 'mouse' || motion.current.reduced) return
      motion.current.x = clamp((event.clientX / window.innerWidth - 0.5) * 2)
      motion.current.y = clamp((0.5 - event.clientY / window.innerHeight) * 2)
      if (stage.current) {
        stage.current.dataset.input = 'pointer'
        stage.current.dataset.targetX = String(motion.current.x)
        stage.current.dataset.targetY = String(motion.current.y)
      }
    }
    const reset = () => {
      motion.current.x = 0
      motion.current.y = 0
    }
    window.addEventListener('pointermove', onPointer)
    window.addEventListener('blur', reset)

    const touchDevice = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches
    if (touchDevice && typeof window.DeviceOrientationEvent !== 'undefined') {
      setPermission(typeof window.DeviceOrientationEvent.requestPermission === 'function' ? 'request' : 'automatic')
    }
    return () => {
      preference.removeEventListener('change', updatePreference)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('blur', reset)
    }
  }, [])

  useEffect(() => {
    if (permission !== 'automatic' && permission !== 'enabled') return
    const onOrientation = (event) => {
      if (motion.current.reduced || !Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return
      if (!orientationBaseline.current) orientationBaseline.current = { gamma: event.gamma, beta: event.beta }
      const horizontal = angleDelta(event.gamma, orientationBaseline.current.gamma)
      const vertical = angleDelta(event.beta, orientationBaseline.current.beta)
      const angle = window.screen.orientation?.angle ?? window.orientation ?? 0
      // Rotate the axes with the screen, so a landscape phone still moves naturally.
      const axes = angle === 90 ? [vertical, -horizontal]
        : angle === 270 || angle === -90 ? [-vertical, horizontal]
          : angle === 180 || angle === -180 ? [-horizontal, -vertical]
            : [horizontal, vertical]
      motion.current.x = clamp(axes[0] / 20)
      motion.current.y = clamp(-axes[1] / 20)
      if (stage.current) {
        stage.current.dataset.input = 'tilt'
        stage.current.dataset.targetX = String(motion.current.x)
        stage.current.dataset.targetY = String(motion.current.y)
      }
    }
    const recalibrate = () => { orientationBaseline.current = null }
    window.addEventListener('deviceorientation', onOrientation)
    window.addEventListener('orientationchange', recalibrate)
    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('orientationchange', recalibrate)
    }
  }, [permission])

  async function enableTilt() {
    try {
      const result = await window.DeviceOrientationEvent.requestPermission()
      setPermission(result === 'granted' ? 'enabled' : 'denied')
    } catch {
      setPermission('denied')
    }
  }

  return (
    <div className="showcase">
      <div ref={stage} className="showcase-stage" data-ready={ready ? 'true' : 'false'} data-input="still"
        role="img" aria-label="A floating Game Boy Advance cartridge with a Metroid Fusion label">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 4.4], fov: 32, near: 0.1, far: 60 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          onCreated={({ gl }) => { gl.toneMappingExposure = 0.75 }}
          fallback={<span className="showcase-fallback">Game Boy Advance cartridge</span>}>
          <StudioEnvironment />
          <SceneLighting carousel={LIGHT_STATE} />
          <Suspense fallback={null}>
            <Cartridge motion={motion} onReady={onReady} />
          </Suspense>
        </Canvas>
      </div>
      {permission === 'request' && !reduced && (
        <button className="showcase-motion" type="button" onClick={enableTilt}>Enable phone tilt</button>
      )}
      {permission === 'denied' && <p className="showcase-motion-note">Phone tilt unavailable.</p>}
    </div>
  )
}
