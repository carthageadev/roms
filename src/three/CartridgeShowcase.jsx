import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MODELS } from '../data/cartridgeModels.js'
import { configureShellMaterial, labelFinishParameters, prepareModel, SceneLighting } from './Scene.jsx'
import { RoomEnvironment } from './roomEnvironment.js'

const LIGHT_STATE = { pose: 'default' }
// Room the cartridge is allowed to take on the stage, as a fraction of the
// visible height and width. Every system then sits at the same visual weight,
// whether the shell is tall like an NES cart or wide like a SNES one.
const TARGET_HEIGHT = 0.72
const TARGET_WIDTH = 0.9

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

function Cartridge({ platform, label, motion, onReady }) {
  const config = MODELS[platform]
  const restYaw = config.faceRotation ?? Math.PI
  const group = useRef(null)
  const { scene } = useGLTF(config.url)
  const { camera, size } = useThree()
  const entries = useMemo(() => Object.entries(config.shellMaps || {}), [config])
  const textures = useLoader(THREE.TextureLoader, [
    ...entries.map(([, url]) => url),
    label,
    ...(config.plasticMask ? [config.plasticMask] : []),
  ])
  const prepared = useMemo(() => prepareModel(scene, config), [scene, config])

  const configuredTextures = useMemo(() => {
    entries.forEach(([name], index) => {
      const texture = textures[index]
      texture.flipY = false
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.colorSpace = name === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.userData.panoplyRGNormal = name === 'normalMap'
      texture.anisotropy = 8
      texture.needsUpdate = true
    })
    const artTexture = textures[entries.length]
    artTexture.flipY = false
    artTexture.colorSpace = THREE.SRGBColorSpace
    artTexture.anisotropy = 8
    artTexture.needsUpdate = true
    const mask = config.plasticMask ? textures[entries.length + 1] : null
    if (mask) {
      mask.flipY = false
      mask.wrapS = mask.wrapT = THREE.RepeatWrapping
      mask.colorSpace = THREE.NoColorSpace
      mask.anisotropy = 8
      mask.needsUpdate = true
    }
    return {
      maps: Object.fromEntries(entries.map(([name], index) => [name, textures[index]])),
      art: artTexture,
      mask,
    }
  }, [config.plasticMask, entries, textures])

  const materials = useMemo(() => {
    const { maps, art: artTexture, mask } = configuredTextures
    const shell = configureShellMaterial(
      new THREE.MeshPhysicalMaterial({ ...maps, color: config.shellColor || '#ffffff' }),
      'default',
      config.shellColor,
      {
        shellFinish: config.shellFinish,
        albedoRef: config.albedoRef,
        plasticMask: mask,
      },
    )
    const hasInner = prepared.parts.some((part) => part.roles.includes('inner'))
    const inner = hasInner && !config.preserveInnerMaterials
      ? new THREE.MeshPhysicalMaterial({
          ...maps,
          color: '#ffffff',
          roughness: 0.72,
          metalness: 0.06,
          clearcoat: 0.1,
          clearcoatRoughness: 0.42,
        })
      : null
    const finish = labelFinishParameters('default')
    const labelUv = config.labelUv
    const uvWindow = new THREE.Vector4(
      labelUv?.u?.[0] ?? 0,
      labelUv?.v?.[0] ?? 0,
      (labelUv?.u?.[1] ?? 1) - (labelUv?.u?.[0] ?? 0),
      (labelUv?.v?.[1] ?? 1) - (labelUv?.v?.[0] ?? 0),
    )
    const art = new THREE.MeshPhysicalMaterial({
      map: artTexture,
      roughness: finish.roughness,
      metalness: finish.metalness,
      clearcoat: finish.clearcoat,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    })
    art.onBeforeCompile = (shader) => {
      shader.uniforms.panoplyUvWindow = { value: uvWindow }
      shader.vertexShader = `uniform vec4 panoplyUvWindow;\n${shader.vertexShader}`
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = (vMapUv - panoplyUvWindow.xy) / panoplyUvWindow.zw;\n#endif`,
      )
    }
    art.customProgramCacheKey = () => 'showcase-label-uv-v1'
    const owned = [shell, inner, art].filter(Boolean)
    const resolved = prepared.parts.map((part) => {
      const choices = part.materials.map((material, i) => {
        if (part.roles[i] === 'shell') {
          if (!config.preserveShellMaterials) return shell
          const copy = material.clone()
          configureShellMaterial(copy, 'default')
          owned.push(copy)
          return copy
        }
        if (part.roles[i] === 'inner') {
          // The newer shells ship their own board maps; keep them as authored.
          if (config.preserveInnerMaterials) return material
          if (inner) return inner
        }
        if (part.roles[i] === 'label') return art
        const copy = material.clone()
        owned.push(copy)
        return copy
      })
      return part.materialArray ? choices : choices[0]
    })
    return { resolved, owned }
  }, [config, entries, prepared, configuredTextures])

  // Fit the whole cartridge inside the visible stage instead of trusting a
  // single normalised height: the four shells have very different proportions.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromPoints(prepared.corners)
    const dims = box.getSize(new THREE.Vector3())
    const viewHeight = 2 * Math.abs(camera.position.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const viewWidth = viewHeight * (size.width / Math.max(1, size.height))
    const value = Math.min(
      (viewHeight * TARGET_HEIGHT) / Math.max(0.001, dims.y),
      (viewWidth * TARGET_WIDTH) / Math.max(0.001, dims.x),
      2.2,
    )
    return value
  }, [prepared, camera, size])

  useEffect(() => {
    onReady()
    return () => materials.owned.forEach((material) => material.dispose())
  }, [materials, onReady])

  const arrival = useRef(0)
  useFrame((state, delta) => {
    const node = group.current
    if (!node) return
    const { x, y, reduced } = motion.current
    const step = Math.min(delta, 0.1)
    const time = state.clock.elapsedTime
    arrival.current = reduced ? 1 : Math.min(1, arrival.current + delta / 1.1)
    const settle = 1 - (1 - arrival.current) ** 3
    const float = reduced ? 0 : Math.sin(time * 0.75) * 0.022
    // Inputs are bounded; the cartridge tips by only a few degrees, never spins.
    node.position.x = THREE.MathUtils.damp(node.position.x, reduced ? 0 : x * 0.025, 3, step)
    node.position.y = THREE.MathUtils.damp(node.position.y, reduced ? 0 : float + y * 0.018, 3, step)
    node.position.z = THREE.MathUtils.damp(node.position.z, (1 - settle) * -0.5, 3, step)
    node.rotation.x = THREE.MathUtils.damp(node.rotation.x, -0.035 + (reduced ? 0 : y * 0.045), 3, step)
    node.rotation.y = THREE.MathUtils.damp(node.rotation.y, restYaw + (reduced ? 0 : x * 0.065), 3, step)
    node.rotation.z = THREE.MathUtils.damp(node.rotation.z, reduced ? 0 : -x * 0.012, 3, step)
    node.scale.setScalar(0.94 + 0.06 * settle)
  })

  return (
    <group ref={group} rotation={[-0.035, restYaw, 0]}>
      <group scale={prepared.normScale * fit}>
        <group rotation={config.rotation || [0, 0, 0]}>
          <group position={prepared.modelOffset}>
            {prepared.parts.map((part, index) => (
              <mesh
                key={index}
                geometry={part.geometry}
                material={materials.resolved[index]}
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

const clamp = (value) => Math.max(-1, Math.min(1, value))
const angleDelta = (value, baseline) => ((value - baseline + 540) % 360) - 180

export default function CartridgeShowcase({ platform, platformName, title, label }) {
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

  const description = `A floating ${platformName} cartridge with a ${title} label`

  return (
    <div className="showcase" data-ready={ready ? 'true' : 'false'} data-platform={platform}>
      <div ref={stage} className="showcase-stage" data-input="still" role="img" aria-label={description}>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0.15, 7.4], fov: 35, near: 0.1, far: 60 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          fallback={<span className="showcase-fallback">{platformName} cartridge</span>}
        >
          <StudioEnvironment />
          <SceneLighting carousel={LIGHT_STATE} />
          <Suspense fallback={null}>
            <Cartridge platform={platform} label={label} motion={motion} onReady={onReady} />
          </Suspense>
        </Canvas>
      </div>
      <div className="showcase-caption" aria-hidden="true">
        <span className="showcase-system">{platformName}</span>
        <span className="showcase-game">{title}</span>
      </div>
      {permission === 'request' && !reduced && (
        <button className="showcase-motion" type="button" onClick={enableTilt}>Move with your phone</button>
      )}
      {permission === 'denied' && !reduced && (
        <span className="showcase-motion-note">Tilt unavailable</span>
      )}
    </div>
  )
}
