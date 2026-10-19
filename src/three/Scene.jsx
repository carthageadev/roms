import {
  Suspense,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Html, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { FOIL, foilShader, foilRadiance, foilNormal, foilPhysical } from './labelFoil.js'
import { useInspectRotation } from './useInspectRotation.js'
import {
  DEFAULT_CUSTOM_POSE,
  DEFAULT_LIGHTING_PROFILE,
  DEFAULT_TILTED_POSE,
  seamlessCarouselSlotCount,
} from '../lib/carouselPrefs.js'
import { RoomEnvironment } from './roomEnvironment'

// Models are normalized on import, so these are calibrated to the reference
// screen proportions rather than copied from the reference unnormalized transforms.
const CENTER_SCALE = 1.15
const SIDE_SCALE = 0.95
const ROW_BOTTOM = -0.32 // normalized screen Y, shared by every resting slot

// Keep the neighboring slots at 15% and 85% of the viewport. Fit narrow
// windows to their width while preserving the reference proportions on TV.
function carouselLayout(camera, spacingScale = 1) {
  const fit = Math.min(1, camera.aspect / (16 / 9))
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  return {
    fit,
    spacing: 2 * halfHeight * (camera.position.z + 0.85) * camera.aspect * 0.35 * spacingScale,
  }
}
const MODEL_ROT_Y = Math.PI // .glb exports facing away from camera; flip to show the label

// Only the selected cartridge tilts; neighboring cartridges remain upright.
function centerPose(carousel, isCenter, frontFacing) {
  if (!isCenter || frontFacing) return { pitch: 0, yaw: 0, roll: 0 }
  if (carousel.editorPreview || carousel.pose === 'custom') return carousel.customPose || DEFAULT_CUSTOM_POSE
  return DEFAULT_TILTED_POSE
}

// Underdamped spring: quick slide with one subtle overshoot bounce,
// matching the reference footage of the carousel motion.
const SPRING_OMEGA = 19
const SPRING_ZETA = 0.62

function springStep(pos, vel, target, dt, omega = SPRING_OMEGA, zeta = SPRING_ZETA) {
  const accel = -omega * omega * (pos - target) - 2 * zeta * omega * vel
  const nextVel = vel + accel * dt
  return [pos + nextVel * dt, nextVel]
}

// Insert timeline (seconds): a bouncy hop above the row with a full spin.
// The rise overshoots its apex and springs back, followed by a fast drop.
// into the "slot" at the bottom of the screen. The landing is dead solid (the
// cart is physically seated, it can't rebound) and it stays poking out
// part-way, N64 style, instead of vanishing off-screen.
const INSERT = { rise: 0.3, hang: 0.1, drop: 0.16 }
const INSERT_APEX_Y = 1.6
const INSERT_SLOT_Y = -1.7 // roughly a third of the cart buried below the screen edge

const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3)
const easeInQuad = (p) => p * p
// Fast launch that overshoots past 1 and springs back.
const easeOutBack = (p) => 1 + 2.4 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2)
const easeInOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
const CART_HEIGHT = 2.35 // world units the cartridge is normalized to
const FALLBACK_LABEL = '/label-placeholder.svg'
const EMPTY_APPEARANCE = Object.freeze({})
const pendingMaterialDisposals = new WeakMap()
const alignmentPoint = new THREE.Vector3()
const alignmentRotation = new THREE.Euler()

function bottomAlignedY(camera, corners, scale, depth, pitch, yaw, roll, bottom = ROW_BOTTOM) {
  alignmentRotation.set(pitch, yaw, roll)
  const slope = bottom * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom
  let y = -Infinity
  for (const corner of corners) {
    alignmentPoint.copy(corner).applyEuler(alignmentRotation).multiplyScalar(scale)
    y = Math.max(y, camera.position.y + slope * (camera.position.z - depth - alignmentPoint.z) - alignmentPoint.y)
  }
  return y
}

const SHELL_FINISHES = {
  default: { roughness: 0.72, metalness: 0.05, clearcoat: 0.12, opacity: 1 },
  opaque: { roughness: 0.78, metalness: 0.04, clearcoat: 0.16, opacity: 1 },
  translucent: { roughness: 0.38, metalness: 0.02, clearcoat: 0.72, opacity: 0.72 },
  clear: { roughness: 0.12, metalness: 0, clearcoat: 1, opacity: 0.34 },
  glitter: { roughness: 0.42, metalness: 0.08, clearcoat: 0.82, opacity: 0.84 },
  metallic: { roughness: 0.32, metalness: 0.92, clearcoat: 0.42, opacity: 1 },
}

function normalizeShellFinish(value) {
  if (value === 'metal') return 'metallic'
  if (value === 'matte') return 'opaque'
  if (value === 'gloss') return 'opaque'
  return SHELL_FINISHES[value] ? value : 'default'
}

export function configureShellMaterial(material, finishName, tint) {
  const finish = normalizeShellFinish(finishName)
  const values = SHELL_FINISHES[finish]
  if (tint && material.color) material.color.set(tint)
  if ('roughness' in material) material.roughness = values.roughness
  if ('metalness' in material) material.metalness = values.metalness
  if (finish === 'metallic') material.metalnessMap = null
  if ('clearcoat' in material) material.clearcoat = values.clearcoat
  if ('clearcoatRoughness' in material) material.clearcoatRoughness = Math.min(0.45, values.roughness)
  material.transparent = values.opacity < 1
  material.opacity = values.opacity
  material.depthWrite = values.opacity >= 0.7
  material.alphaTest = 0
  material.userData.panoplyBaseOpacity = values.opacity
  material.userData.panoplyAlwaysTransparent = values.opacity < 1

  if (finish !== 'default' && finish !== 'opaque') {
    const finishEffect = finish === 'glitter'
      ? `
          vec3 glitterCell = floor(vPanoplyWorldPosition * 54.0);
          float glitterSeed = panoplyHash(glitterCell);
          float glitterPulse = pow(max(0.0, sin(panoplyTime * (2.0 + glitterSeed * 3.0) + glitterSeed * 25.0)), 34.0);
          float glitterMask = step(0.91, glitterSeed) * glitterPulse;
          vec3 glitterTint = 0.58 + 0.42 * cos(6.28318 * (glitterSeed + vec3(0.0, 0.33, 0.67)));
          float glitterRim = pow(1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0))), 2.2);
          gl_FragColor.rgb += glitterTint * glitterMask * 1.3 + glitterRim * 0.12;
        `
      : finish === 'metallic'
        ? `
          float studioBand = pow(0.5 + 0.5 * sin(vPanoplyWorldPosition.y * 4.2 + vPanoplyWorldPosition.x * 1.1), 6.0);
          float metalRim = pow(1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0))), 2.4);
          gl_FragColor.rgb += vec3(studioBand * 0.18 + metalRim * 0.12);
        `
        : `
          float plasticRim = pow(1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0))), 2.0);
          gl_FragColor.rgb += vec3(plasticRim * 0.16);
          gl_FragColor.a = max(gl_FragColor.a, plasticRim * ${finish === 'clear' ? '0.62' : '0.46'});
        `
    material.onBeforeCompile = (shader) => {
      shader.uniforms.panoplyTime = { value: 0 }
      shader.vertexShader = `varying vec3 vPanoplyWorldPosition;\n${shader.vertexShader}`
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvPanoplyWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
      shader.fragmentShader = `
        uniform float panoplyTime;
        varying vec3 vPanoplyWorldPosition;
        float panoplyHash(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
      ${shader.fragmentShader}`
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
          ${finishEffect}
          #include <dithering_fragment>
        `,
      )
      material.userData.panoplyShader = shader
    }
    material.customProgramCacheKey = () => `panoply-shell-${finish}-v3`
  }
  if (material.normalMap?.userData.panoplyRGNormal) {
    const finishShader = material.onBeforeCompile
    const finishKey = material.customProgramCacheKey()
    material.onBeforeCompile = (shader, renderer) => {
      finishShader.call(material, shader, renderer)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps.replace(
          'mapN.xy *= normalScale;',
          'mapN.z = sqrt(max(1.0 - dot(mapN.xy, mapN.xy), 0.0));\nmapN.xy *= normalScale;',
        ),
      )
    }
    material.customProgramCacheKey = () => `${finishKey}-rg-normal-v1`
  }
  if (tint && material.map) {
    const surfaceShader = material.onBeforeCompile
    const surfaceKey = material.customProgramCacheKey()
    material.onBeforeCompile = (shader, renderer) => {
      surfaceShader.call(material, shader, renderer)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        THREE.ShaderChunk.map_fragment.replace(
          'diffuseColor *= sampledDiffuseColor;',
          'float shellLuma = dot(sampledDiffuseColor.rgb, vec3(0.299, 0.587, 0.114));\ndiffuseColor *= vec4(vec3(mix(1.0, shellLuma, 0.18)), sampledDiffuseColor.a);',
        ),
      )
    }
    material.customProgramCacheKey = () => `${surfaceKey}-shell-tint-v1`
  }
  material.needsUpdate = true
  return material
}

export function labelFinishParameters(style) {
  switch (style) {
    case 'paper':
      return { roughness: 0.94, metalness: 0, clearcoat: 0 }
    case 'gloss':
      return { roughness: 0.18, metalness: 0, clearcoat: 1 }
    case 'golden-ticket':
      return { roughness: 0.24, metalness: 0.72, clearcoat: 0.72 }
    case 'chrome-outline':
      return { roughness: 0.16, metalness: 0.74, clearcoat: 1 }
    case 'rainbow-prism':
    case 'holo-foil':
    case 'foil-texture':
      return { roughness: 0.24, metalness: 0.26, clearcoat: 1 }
    default:
      return { roughness: 0.5, metalness: 0, clearcoat: 0.08 }
  }
}

export function normalizeLabelStyle(value) {
  return value === 'foil' ? 'holo-foil' : value || 'default'
}

export function labelEffectShader(style) {
  if (FOIL[style]) return foilShader(style)
  if (style === 'paper') {
    return `
      float paperGrain = panoplyNoise(vMapUv * vec2(1120.0, 860.0));
      diffuseColor.rgb *= 0.93 + paperGrain * 0.12;
    `
  }
  return ''
}

export function SceneLighting({ carousel, multiplier = 1 }) {
  const ambient = useRef(null)
  const key = useRef(null)
  const fill = useRef(null)
  const rim = useRef(null)

  useFrame((_, delta) => {
    if (!ambient.current || !key.current || !fill.current || !rim.current) return
    const defaultProfile = {
      ambient: DEFAULT_LIGHTING_PROFILE.ambient * multiplier,
      key: DEFAULT_LIGHTING_PROFILE.key * multiplier,
      fill: DEFAULT_LIGHTING_PROFILE.fill * multiplier,
      rim: DEFAULT_LIGHTING_PROFILE.rim * multiplier,
      keyPosition: DEFAULT_LIGHTING_PROFILE.keyPosition,
    }
    const profile = carousel.editorPreview || carousel.pose === 'custom'
      ? carousel.lighting || DEFAULT_LIGHTING_PROFILE
      : defaultProfile
    const keyPosition = profile.keyPosition || defaultProfile.keyPosition
    const blend = 1 - Math.pow(0.001, Math.min(delta, 1 / 30))
    ambient.current.intensity += (profile.ambient - ambient.current.intensity) * blend
    key.current.intensity += (profile.key - key.current.intensity) * blend
    fill.current.intensity += (profile.fill - fill.current.intensity) * blend
    rim.current.intensity += (profile.rim - rim.current.intensity) * blend
    key.current.position.x += (keyPosition.x - key.current.position.x) * blend
    key.current.position.y += (keyPosition.y - key.current.position.y) * blend
    key.current.position.z += (keyPosition.z - key.current.position.z) * blend
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={DEFAULT_LIGHTING_PROFILE.ambient * multiplier} />
      {/* R3F v9 + three r184: a plain-object position prop is assigned directly, and light.position is read-only, so pass an array. */}
      <directionalLight ref={key} position={[DEFAULT_LIGHTING_PROFILE.keyPosition.x, DEFAULT_LIGHTING_PROFILE.keyPosition.y, DEFAULT_LIGHTING_PROFILE.keyPosition.z]} intensity={DEFAULT_LIGHTING_PROFILE.key * multiplier} />
      <directionalLight ref={fill} position={[-5, 2, -3]} intensity={DEFAULT_LIGHTING_PROFILE.fill * multiplier} />
      <directionalLight ref={rim} position={[0, -3, 4]} intensity={DEFAULT_LIGHTING_PROFILE.rim * multiplier} />
    </>
  )
}

// The source disc meshes intentionally carry no baked image. Their surface is
// a reflective optical layer, so keep it procedural instead of letting an
// untextured glTF material render as a flat white card.
export function createDiscMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#b7bdc5',
    metalness: 0.96,
    roughness: 0.12,
    clearcoat: 0.85,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
  })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec2 vPanoplyDiscUv;\n${shader.vertexShader}`
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\nvPanoplyDiscUv = uv;',
    )
    shader.fragmentShader = `varying vec2 vPanoplyDiscUv;\n${shader.fragmentShader}`
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_physical_fragment>',
      `
        #include <lights_physical_fragment>
        vec2 discUv = vPanoplyDiscUv - 0.5;
        float discRadius = length(discUv);
        float discAngle = atan(discUv.y, discUv.x);
        float discFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
        float discGrooves = 0.5 + 0.5 * sin(discRadius * 1700.0 + discAngle * 9.0);
        float discPhase = discRadius * 3.2 + discAngle / 6.28318 +
          (1.0 - discFacing) * 1.8 + normal.x * 0.8;
        vec3 discSpectrum = 0.5 + 0.5 * cos(6.28318 * (discPhase + vec3(0.0, 0.33, 0.67)));
        material.specularColor = mix(material.specularColor, discSpectrum, 0.78);
        material.roughness = 0.09 + discGrooves * 0.055;
        totalEmissiveRadiance += discSpectrum *
          (0.10 + 0.26 * pow(1.0 - discFacing, 1.4)) *
          (0.78 + discGrooves * 0.22);
      `,
    )
  }
  material.customProgramCacheKey = () => 'panoply-disc-v3'
  return material
}

useGLTF.setDecoderPath('/draco/')
useGLTF.preload('/models/n64/cartridge.glb')

const labelTextureResources = new Map()

export function createLabelTextureResource(url, textureQueue) {
  const resource = {
    refs: 0,
    texture: null,
    ready: false,
    disposed: false,
    disposeTimer: null,
    listeners: new Set(),
  }
  labelTextureResources.set(url, resource)

  const fail = () => {
    if (labelTextureResources.get(url) === resource) labelTextureResources.delete(url)
    resource.disposed = true
    resource.listeners.clear()
  }
  const apply = (texture) => {
    if (resource.disposed) {
      texture.image?.close?.()
      texture.dispose()
      return
    }
    texture.flipY = false
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    resource.texture = texture
    textureQueue.push((gl) => {
      if (resource.disposed) return
      gl.initTexture(texture)
      resource.ready = true
      resource.listeners.forEach((listener) => listener(texture))
    })
  }

  if ('createImageBitmap' in window && !/\.svg(?:[?#]|$)/i.test(url)) {
    const loader = new THREE.ImageBitmapLoader()
    loader.setOptions({ imageOrientation: 'from-image', premultiplyAlpha: 'none' })
    loader.load(url, (bitmap) => {
      const texture = new THREE.Texture(bitmap)
      texture.needsUpdate = true
      apply(texture)
    }, undefined, fail)
  } else {
    new THREE.TextureLoader().load(url, apply, undefined, fail)
  }
  return resource
}

export function releaseLabelTexture(url, resource) {
  resource.refs = Math.max(0, resource.refs - 1)
  if (resource.refs > 0) return
  resource.disposeTimer = setTimeout(() => {
    if (resource.refs > 0 || labelTextureResources.get(url) !== resource) return
    labelTextureResources.delete(url)
    resource.disposed = true
    resource.listeners.clear()
    resource.texture?.image?.close?.()
    resource.texture?.dispose()
  }, 5000)
}

// Duplicate seamless slots share one decoded image and one GPU texture.
export function useLabelTexture(url, fallback, textureQueue) {
  const [tex, setTex] = useState(fallback)
  useEffect(() => {
    let alive = true
    setTex(fallback)
    if (!url) return () => {}
    const resource = labelTextureResources.get(url) || createLabelTextureResource(url, textureQueue)
    clearTimeout(resource.disposeTimer)
    resource.refs += 1
    const update = (texture) => {
      if (alive) setTex(texture)
    }
    resource.listeners.add(update)
    if (resource.ready && resource.texture) setTex(resource.texture)
    return () => {
      alive = false
      resource.listeners.delete(update)
      releaseLabelTexture(url, resource)
    }
  }, [url, fallback, textureQueue])
  return tex
}

export function TextureWarmup({ queue }) {
  const gl = useThree((s) => s.gl)
  const lastUpload = useRef(-Infinity)
  useFrame((state) => {
    if (!queue.length || state.clock.elapsedTime - lastUpload.current < 0.06) return
    const upload = queue.shift()
    upload(gl)
    lastUpload.current = state.clock.elapsedTime
  })
  return null
}

export function prepareModel(scene, config, materialMaps = {}) {
  scene.updateMatrixWorld(true)
  const inverseRoot = scene.matrixWorld.clone().invert()
  const labelNodes = new Set(config.labelNodes || [])
  const shellNodes = new Set(config.shellNodes || [])
  const labelMaterials = new Set((config.labelMaterials || []).map((name) => name.toLowerCase()))
  const innerNodes = new Set(config.innerNodes || [])
  const shellMaterials = new Set((config.shellMaterials || []).map((name) => name.toLowerCase()))
  const innerMaterials = new Set((config.innerMaterials || []).map((name) => name.toLowerCase()))
  const discMaterials = new Set((config.discMaterials || []).map((name) => name.toLowerCase()))
  const glassMaterials = new Set((config.glassMaterials || []).map((name) => name.toLowerCase()))
  const hiddenMaterials = new Set((config.hiddenMaterials || []).map((name) => name.toLowerCase()))
  const materialOverrides = new Map()
  const parts = []
  const matchesNode = (object, names) => {
    for (let node = object; node && node !== scene; node = node.parent) {
      if (names.has(node.userData.name || node.name)) return true
    }
    return false
  }

  scene.traverse((object) => {
    if (!object.isMesh || !object.geometry) return
    const isLabelNode = matchesNode(object, labelNodes)
    const isInnerNode = matchesNode(object, innerNodes)
    const isShellNode = matchesNode(object, shellNodes)
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
    const materials = sourceMaterials.map((material) => {
      const materialName = material?.name?.toLowerCase()
      const externalMaps = materialMaps[materialName]
      let resolved = material
      if (externalMaps) {
        const textured = materialOverrides.has(material)
          ? materialOverrides.get(material)
          : material.clone()
        Object.entries(externalMaps).forEach(([slot, texture]) => {
          textured[slot] = texture
        })
        if (externalMaps.map && textured.color) textured.color.set('#ffffff')
        textured.needsUpdate = true
        materialOverrides.set(material, textured)
        resolved = textured
      }
      if (!isLabelNode && hiddenMaterials.has(materialName)) {
        const hidden = materialOverrides.has(material) ? materialOverrides.get(material) : resolved.clone()
        hidden.transparent = true
        hidden.opacity = 0
        hidden.depthWrite = false
        hidden.colorWrite = false
        materialOverrides.set(material, hidden)
        return hidden
      }
      if (!glassMaterials.has(materialName)) return resolved
      const glass = materialOverrides.has(material) ? materialOverrides.get(material) : resolved.clone()
      glass.transparent = true
      glass.opacity = 0.16
      glass.depthWrite = false
      glass.roughness = 0.08
      materialOverrides.set(material, glass)
      return glass
    })
    const roles = materials.map((material) => {
      const materialName = material?.name?.toLowerCase()
      if (isLabelNode || labelMaterials.has(materialName)) {
        return 'label'
      }
      if (isInnerNode || innerMaterials.has(materialName)) {
        return 'inner'
      }
      if (discMaterials.has(materialName)) return 'disc'
      return isShellNode || shellMaterials.has(material?.name?.toLowerCase())
        ? 'shell'
        : 'original'
    })
    parts.push({
      geometry: object.geometry,
      matrix: inverseRoot.clone().multiply(object.matrixWorld),
      materials,
      roles,
      materialArray: Array.isArray(object.material),
    })
  })

  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const sourceSize = config.fit === 'height' ? size.y : Math.max(size.x, size.y, size.z)
  const modelRotation = new THREE.Euler(...(config.rotation || [0, 0, 0]))
  const corners = []
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        corners.push(new THREE.Vector3(x, y, z).sub(center).applyEuler(modelRotation))
      }
    }
  }
  const rotatedHeight = new THREE.Box3().setFromPoints(corners).getSize(new THREE.Vector3()).y
  const normScale = Math.min((config.targetSize || CART_HEIGHT) / (sourceSize || 1), 1.8 / (rotatedHeight || 1))
  corners.forEach((corner) => corner.multiplyScalar(normScale))

  return {
    parts,
    modelOffset: center.multiplyScalar(-1),
    normScale,
    corners,
  }
}

// `carousel` is a mutable store ({ platform, selected[], launching }) read
// directly by the frame loop. Selection changes never re-render this tree.
// React only updates the HUD, so a keypress costs nothing here.
const Cartridge = memo(function Cartridge({
  platformIndex,
  index,
  gameIndex,
  count,
  carousel,
  artUrl,
  artStatus,
  onPick,
  onLaunch,
  parts,
  modelOffset,
  normScale,
  corners,
  modelRotation,
  faceRotation,
  shellTextures,
  shellColor,
  preserveInnerMaterials = false,
  fallbackLabel,
  textureQueue,
  progressive,
  appearance,
}) {
  const camera = useThree((state) => state.camera)
  const outer = useRef()
  const inner = useRef()
  const inspection = useInspectRotation(carousel, platformIndex, index)
  const centerStatusRef = useRef(false)
  const [showCenterStatus, setShowCenterStatus] = useState(false)
  const [statusPhase, setStatusPhase] = useState('visible')
  const fetchState = artStatus?.state || 'queued'
  const fetchLabel =
    fetchState === 'ready'
      ? 'ART OK'
      : fetchState === 'loading'
        ? 'FETCHING'
        : fetchState === 'error'
          ? 'ART ERROR'
          : 'QUEUED'
  const fetchIcon = fetchState === 'ready' ? '✓' : fetchState === 'error' ? '!' : '…'

  useEffect(() => {
    let fadeTimer
    let removeTimer
    setStatusPhase('visible')
    if (fetchState === 'ready') {
      fadeTimer = setTimeout(() => setStatusPhase('fading'), 3000)
      removeTimer = setTimeout(() => setStatusPhase('hidden'), 3350)
    }
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [fetchState])

  const setCenterStatus = (visible) => {
    if (centerStatusRef.current === visible) return
    centerStatusRef.current = visible
    setShowCenterStatus(visible)
  }

  const bodyMat = useMemo(() => {
    if (!shellTextures && !shellColor) return null
    const material = new THREE.MeshPhysicalMaterial({
      ...(shellTextures || {}),
      color: appearance.casingColor || shellColor || '#ffffff',
    })
    return configureShellMaterial(material, appearance.material || 'default', appearance.casingColor)
  }, [shellTextures, shellColor, appearance.casingColor, appearance.material])

  const hasInnerParts = useMemo(
    () => parts.some((part) => part.roles.includes('inner')),
    [parts],
  )
  const innerMat = useMemo(() => {
    if (!shellTextures || !hasInnerParts || preserveInnerMaterials) return null
    return new THREE.MeshPhysicalMaterial({
      ...shellTextures,
      color: '#ffffff',
      roughness: 0.72,
      metalness: 0.06,
      clearcoat: 0.1,
      clearcoatRoughness: 0.42,
    })
  }, [shellTextures, hasInnerParts, preserveInnerMaterials])

  const hasDiscParts = useMemo(
    () => parts.some((part) => part.roles.includes('disc')),
    [parts],
  )
  const discMat = useMemo(() => (hasDiscParts ? createDiscMaterial() : null), [hasDiscParts])

  const labelTex = useLabelTexture(artUrl, fallbackLabel, textureQueue)
  const foilPatterns = useTexture(['/textures/common/foil-primary.jpg', '/textures/common/foil-secondary.jpg'])
  useLayoutEffect(() => {
    foilPatterns.forEach((texture) => {
      texture.flipY = false
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.colorSpace = THREE.NoColorSpace
      texture.needsUpdate = true
    })
  }, [foilPatterns])
  const labelReveal = useRef(0)
  const labelMat = useMemo(() => {
    const style = normalizeLabelStyle(appearance.labelStyle)
    const finish = labelFinishParameters(style)
    const foil = FOIL[style]
    const material = new THREE.MeshPhysicalMaterial({
      roughness: foil ? 0.85 : finish.roughness,
      metalness: foil ? 0 : finish.metalness,
      clearcoat: foil ? 0.6 : finish.clearcoat,
      clearcoatRoughness: style === 'paper' ? 0.6 : 0.12,
      iridescence: ['holo-foil', 'rainbow-prism'].includes(style) ? 1 : 0,
      iridescenceIOR: 1.7,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    })
    const offset = new THREE.Vector2(appearance.coverX || 0, appearance.coverY || 0)
    const zoom = appearance.coverZoom || 1
    const effectShader = labelEffectShader(style)
    material.onBeforeCompile = (shader) => {
      shader.uniforms.panoplyUvOffset = { value: offset }
      shader.uniforms.panoplyUvZoom = { value: zoom }
      shader.uniforms.panoplyTime = { value: 0 }
      shader.uniforms.panoplyReveal = { value: 0 }
      shader.uniforms.panoplySurfaceView = { value: 0 }
      shader.uniforms.panoplyFoilPattern = { value: foilPatterns[foil?.alternate ? 1 : 0] }
      shader.vertexShader = `varying vec2 vPanoplyLabelUv;\n${shader.vertexShader}`
      shader.vertexShader = `uniform vec2 panoplyUvOffset;\nuniform float panoplyUvZoom;\n${shader.vertexShader}`
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvPanoplyLabelUv = uv;\n#ifdef USE_MAP\nvMapUv = (vMapUv - 0.5) / panoplyUvZoom + 0.5 + panoplyUvOffset;\n#endif',
      )
      shader.fragmentShader = `
        uniform float panoplyTime;
        uniform sampler2D panoplyFoilPattern;
        varying vec2 vPanoplyLabelUv;
        uniform float panoplyReveal;
        uniform float panoplySurfaceView;
        float panoplyNoise(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
      ${shader.fragmentShader}`
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>\n#ifdef USE_MAP\n${effectShader}\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), panoplyReveal * 0.65);\n#endif`,
      )
      if (foil) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          #ifdef USE_MAP
          if (panoplySurfaceView > 0.5 && panoplySurfaceView < 1.5) outgoingLight = vec3(foilMask);
          if (panoplySurfaceView > 1.5) outgoingLight = normal * 0.5 + 0.5;
          #endif
          #include <opaque_fragment>`)
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${foilNormal}`)
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n${foilPhysical(style)}`)
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${foilRadiance(style)}`)
        shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n#ifdef USE_MAP\nroughnessFactor = mix(roughnessFactor, ${foil.rough}, foilStrength);\n#endif`)
        shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n#ifdef USE_MAP\nmetalnessFactor = mix(metalnessFactor, ${foil.metal.toFixed(2)}, foilStrength);\n#endif`)
      }
      material.userData.panoplyShader = shader
    }
    material.customProgramCacheKey = () => `panoply-label-${style}-v6`
    return material
  }, [appearance.coverX, appearance.coverY, appearance.coverZoom, appearance.labelStyle, foilPatterns])
  useEffect(() => {
    labelReveal.current = 0
    labelMat.map = labelTex
    labelMat.needsUpdate = true
  }, [labelTex, labelMat])
  const styledShellMaterials = useMemo(() => {
    const result = new Map()
    if (!appearance.casingColor && (!appearance.material || appearance.material === 'default')) return result
    parts.forEach((part) => {
      part.materials.forEach((material, index) => {
        if (part.roles[index] !== 'shell' || bodyMat || result.has(material)) return
        const clone = material.clone()
        result.set(
          material,
          configureShellMaterial(clone, appearance.material || 'default', appearance.casingColor),
        )
      })
    })
    return result
  }, [parts, bodyMat, appearance.casingColor, appearance.material])

  const resolvedMaterials = useMemo(
    () => parts.map((part) => {
      const materials = part.materials.map((material, index) => {
        if (part.roles[index] === 'label') return labelMat
        if (part.roles[index] === 'inner' && innerMat) return innerMat
        if (part.roles[index] === 'disc' && discMat) return discMat
        if (part.roles[index] === 'shell' && bodyMat) return bodyMat
        if (part.roles[index] === 'shell' && styledShellMaterials.has(material)) return styledShellMaterials.get(material)
        return material
      })
      return part.materialArray ? materials : materials[0]
    }),
    [parts, labelMat, innerMat, discMat, bodyMat, styledShellMaterials],
  )

  useEffect(() => {
    const materials = [bodyMat, innerMat, discMat, labelMat, ...styledShellMaterials.values()].filter(Boolean)
    materials.forEach((material) => {
      clearTimeout(pendingMaterialDisposals.get(material))
      pendingMaterialDisposals.delete(material)
    })
    return () => {
      // Cancel only resources reused by StrictMode or the next appearance.
      materials.forEach((material) => {
        pendingMaterialDisposals.set(material, setTimeout(() => {
          material.dispose()
          pendingMaterialDisposals.delete(material)
        }, 0))
      })
    }
  }, [bodyMat, innerMat, discMat, labelMat, styledShellMaterials])

  const vel = useRef({ x: 0, y: 0, s: 0 })
  const rot = useRef({ pitch: 0, yaw: 0, roll: 0 })
  const slide = useRef({ key: null, start: 0, x: 0, scale: 1 })
  const launchStart = useRef(null)
  const settling = useRef(false) // post-insert return to the row: still rigid
  const uscale = useRef(1) // uniform base scale; squash/stretch is applied on top
  const reveal = useRef(1) // 0..1 fade progress for platform-switch crossfade
  const delayTimer = useRef(null) // staggers the reveal wave outward from center
  const prevY = useRef(0)
  const previousOffset = useRef(null)

  useFrame((state, delta) => {
    if (!outer.current || !inner.current) return
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 1 / 30) // clamp so springs stay stable after tab switches
    const pose = inspection.step(dt)
    const active = carousel.platform === platformIndex
    if (!active && !outer.current.visible) return
    const selectedPosition = selectedPositionForCarousel(carousel, platformIndex)
    const offset = offsetForCarousel(index - selectedPosition, count, carousel.loopMode)
    const launching = carousel.launching && active
    const isCenter = offset === 0
    const editorMode = Boolean(carousel.editorOpen)
    const focused = active && carousel.drawerOpen
    const inspecting = focused && !editorMode
    const frontFacing = !carousel.editorPreview && carousel.pose === 'front' && !inspecting
    const defaultSpring = frontFacing
    const transitionType = carousel.transitionType || 'default'
    const springTransition = transitionType === 'swing' || (transitionType === 'default' && defaultSpring)
    const resting = centerPose(carousel, isCenter, frontFacing)
    const restingPitch = resting.pitch
    const restingYaw = resting.yaw
    const restingRoll = resting.roll
    const pos = outer.current.position

    const layout = carouselLayout(camera, carousel.spacing)
    const targetX = offset * layout.spacing
    const targetZ = isCenter ? (focused ? 1.05 : 0.45) : -0.85
    const targetScale = (isCenter ? CENTER_SCALE * (focused ? 1.12 : 1) : SIDE_SCALE) * layout.fit
    const targetY = bottomAlignedY(camera, corners, targetScale, targetZ, restingPitch, faceRotation + restingYaw, restingRoll, focused ? -0.55 : ROW_BOTTOM)
    const shouldShow = active && Math.abs(offset) <= 2 && (!inspecting || isCenter)
    const recycled = carousel.loopMode === 'seamless' &&
      previousOffset.current !== null &&
      Math.abs(offset - previousOffset.current) > count / 2
    previousOffset.current = offset
    setCenterStatus(shouldShow && isCenter)

    if (recycled) {
      outer.current.visible = false
      reveal.current = 0
      delayTimer.current = null
      pos.set(targetX, targetY - 1.2, targetZ)
      uscale.current = targetScale * 0.55
      outer.current.scale.setScalar(uscale.current)
      prevY.current = pos.y
      vel.current.x = vel.current.y = vel.current.s = 0
      rot.current.pitch = restingPitch
      rot.current.yaw = restingYaw
      rot.current.roll = restingRoll
      slide.current.key = null
      return
    }
    labelReveal.current = Math.min(1, labelReveal.current + dt / 0.22)
    if (labelMat.userData.panoplyShader) {
      labelMat.userData.panoplyShader.uniforms.panoplyTime.value = t
      labelMat.userData.panoplyShader.uniforms.panoplySurfaceView.value = carousel.surfaceView || 0
      const revealAge = (performance.now() - (carousel.revealAt || -Infinity)) / 1000
      labelMat.userData.panoplyShader.uniforms.panoplyReveal.value =
        isCenter && active && !carousel.reducedMotion && revealAge < 0.65
          ? Math.max(0, Math.sin(Math.min(1, revealAge / 0.65) * Math.PI)) : 0
    }
    if (bodyMat?.userData.panoplyShader) {
      bodyMat.userData.panoplyShader.uniforms.panoplyTime.value = t
    }
    if (discMat?.userData.panoplyShader) {
      discMat.userData.panoplyShader.uniforms.panoplyTime.value = t
    }
    styledShellMaterials.forEach((material) => {
      if (material.userData.panoplyShader) {
        material.userData.panoplyShader.uniforms.panoplyTime.value = t
      }
    })

    const applyFade = () => {
      const a = THREE.MathUtils.clamp(reveal.current, 0, 1)
      const fading = a < 1
      if (bodyMat && bodyMat.transparent !== (fading || bodyMat.userData.panoplyAlwaysTransparent)) {
        bodyMat.transparent = fading || bodyMat.userData.panoplyAlwaysTransparent
      }
      if (innerMat && innerMat.transparent !== fading) {
        innerMat.transparent = fading
        innerMat.depthWrite = !fading
      }
      const labelFading = fading || labelReveal.current < 1
      if (labelMat.transparent !== labelFading) labelMat.transparent = labelFading
      if (bodyMat) bodyMat.opacity = (bodyMat.userData.panoplyBaseOpacity || 1) * a
      if (innerMat) innerMat.opacity = a
      labelMat.opacity = a * labelReveal.current
    }

    // Hidden carts stay mounted (no rebuild jank). Leaving carts fade out
    // briefly, then park just below their slot at half scale, so the next
    // reveal crossfades + pops ("pings") into place instead of hard-spawning.
    if (!shouldShow) {
      launchStart.current = null
      settling.current = false
      delayTimer.current = null
      if (reveal.current > 0 && outer.current.visible) {
        reveal.current = Math.max(0, reveal.current - dt / 0.09)
        pos.y -= dt * 1.4 // slight sink while fading out
        applyFade()
        if (reveal.current > 0) return
      }
      outer.current.visible = false
      pos.set(targetX, targetY - 1.2, targetZ)
      uscale.current = targetScale * 0.55
      outer.current.scale.setScalar(uscale.current)
      prevY.current = pos.y
      vel.current.x = vel.current.y = vel.current.s = 0
      rot.current.pitch = restingPitch
      rot.current.yaw = restingYaw
      rot.current.roll = restingRoll
      return
    }

    if (!outer.current.visible) {
      // staggered reveal: a quick wave rippling outward from the center slot
      if (delayTimer.current === null) delayTimer.current = Math.abs(offset) * 0.05
      delayTimer.current -= dt
      if (delayTimer.current > 0) return
      delayTimer.current = null
      outer.current.visible = true
      reveal.current = 0
      vel.current.s = 5
    }
    if (reveal.current < 1) reveal.current = Math.min(1, reveal.current + dt / 0.11)
    applyFade()

    // The default follows the profile. Explicit modes use one motion across profiles.
    const motionKey = `${offset}:${frontFacing}:${transitionType}:${inspecting}:${focused}:${layout.spacing}:${layout.fit}:${restingPitch}:${restingYaw}:${restingRoll}`
    if (slide.current.key !== motionKey) {
      slide.current = { key: motionKey, start: t, x: pos.x, scale: uscale.current }
    }
    if (springTransition) {
      ;[pos.x, vel.current.x] = springStep(pos.x, vel.current.x, targetX, dt)
      const [s, sv] = springStep(uscale.current, vel.current.s, targetScale, dt, 16, 0.6)
      uscale.current = s
      vel.current.s = sv
    } else {
      const p = Math.min(1, (t - slide.current.start) / 0.3)
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      pos.x = THREE.MathUtils.lerp(slide.current.x, targetX, eased)
      uscale.current = THREE.MathUtils.lerp(slide.current.scale, targetScale, eased)
      vel.current.x = vel.current.s = 0
    }
    pos.z += (targetZ - pos.z) * (1 - Math.pow(0.001, dt))

    // Insert animation: choreographed y-path + full spin for the featured cart
    let spin = 0
    let flightTilt = 0
    const inFlight = launching && isCenter
    if (inFlight) {
      if (launchStart.current === null) launchStart.current = t
      const lt = t - launchStart.current
      const { rise, hang, drop } = INSERT
      if (lt < rise) {
        // Bouncy launch: shoots up fast, overshoots the apex, springs back
        pos.y = targetY + (INSERT_APEX_Y - targetY) * easeOutBack(lt / rise)
      } else if (lt < rise + hang) {
        pos.y = INSERT_APEX_Y + Math.sin((lt - rise) * 14) * 0.03
      } else if (lt < rise + hang + drop) {
        // Fast accelerating drop straight into the slot
        const q = easeInQuad((lt - rise - hang) / drop)
        pos.y = INSERT_APEX_Y + (INSERT_SLOT_Y - INSERT_APEX_Y) * q
      } else {
        pos.y = INSERT_SLOT_Y // seated dead solid until App ends the launch
      }
      vel.current.y = 0
      const spinP = Math.min(lt / (rise + hang), 1)
      spin = 2 * Math.PI * easeInOutQuad(spinP)
      flightTilt = Math.sin(spinP * Math.PI) * 0.24
    } else {
      if (launchStart.current !== null) settling.current = true
      launchStart.current = null
      // After an insert the cart sits in the slot; the spring pops it back up.
      if (springTransition || settling.current) {
        ;[pos.y, vel.current.y] = springStep(pos.y, vel.current.y, targetY, dt, 13, 0.7)
      } else {
        pos.y += (targetY - pos.y) * (1 - Math.pow(0.000001, dt))
        vel.current.y = 0
      }
      if (settling.current && Math.abs(pos.y - targetY) < 0.04 && Math.abs(vel.current.y) < 0.2)
        settling.current = false
    }

    // Squash & stretch: elongate along vertical motion, squash sideways to
    // conserve volume. Platform-switch reveals only, like a rigid cartridge
    // inserted must NOT deform, so the insert flight is exempt.
    const vy = (pos.y - prevY.current) / Math.max(dt, 1e-4)
    prevY.current = pos.y
    const stretch =
      !springTransition || inFlight || settling.current ? 0 : Math.min(Math.abs(vy) * 0.028, 0.22)
    outer.current.scale.set(
      Math.max(0.01, uscale.current * (1 - stretch * 0.5)),
      Math.max(0.01, uscale.current * (1 + stretch)),
      Math.max(0.01, uscale.current * (1 - stretch * 0.5)),
    )

    // Smoothly blend toward the resting pose for this slot
    const targetPitch = inFlight ? 0 : restingPitch
    const targetYaw = inFlight ? 0 : restingYaw
    const kRot = 1 - Math.pow(0.002, dt)
    rot.current.pitch += (targetPitch - rot.current.pitch) * kRot
    rot.current.yaw += (targetYaw - rot.current.yaw) * kRot
    rot.current.roll += ((inFlight ? 0 : restingRoll) - rot.current.roll) * kRot

    // Pose + gentle idle sway + launch spin. Sway phase is keyed on the
    // stable index (not offset) so selection changes can't pop the rotation.
    const sway = frontFacing || !isCenter || inspecting || carousel.reducedMotion ? 0 : 0.35
    const floatAmount = carousel.float?.enabled
      ? (isCenter ? carousel.float.center : carousel.float.sides) || 0
      : 0
    const floatY = Math.sin(t * 0.9 + index * 1.37) * 0.026 * floatAmount
    const floatLean = Math.cos(t * 0.68 + index * 0.93) * floatAmount
    inner.current.position.x = Math.sin(t * 0.57 + index * 1.11) * 0.008 * floatAmount
    inner.current.position.y = floatY
    inner.current.rotation.x = rot.current.pitch + Math.sin(t * 0.8 + index) * 0.02 * sway + floatLean * 0.012
    inner.current.rotation.y =
      faceRotation +
      rot.current.yaw +
      spin +
      Math.sin(t * 0.55 + index * 1.7) * (isCenter ? 0.06 : 0.03) * sway + floatLean * 0.016
    // Lean into the direction of travel, proportional to slide velocity
    inner.current.rotation.z =
      rot.current.roll + (springTransition ? THREE.MathUtils.clamp(-vel.current.x * 0.045, -0.2, 0.2) : 0) + flightTilt + Math.sin(t * 0.9 + index * 1.37) * 0.009 * floatAmount
    inner.current.rotation.x += pose.pitch
    inner.current.rotation.y += pose.yaw
  })

  // Initial transform is set ONCE here; after mount the useFrame springs own
  // it exclusively. Passing position/scale as reactive props would make React
  // re-apply them on every selection change, which caused a carousel hitch.
  useLayoutEffect(() => {
    const active = carousel.platform === platformIndex
    const selectedPosition = selectedPositionForCarousel(carousel, platformIndex)
    const off = offsetForCarousel(index - selectedPosition, count, carousel.loopMode)
    const isC = off === 0
    const initiallyVisible = active && Math.abs(off) <= 2
    const layout = carouselLayout(camera, carousel.spacing)
    const initialFrontFacing = !carousel.editorPreview && carousel.pose === 'front' && !carousel.drawerOpen
    const initialPose = centerPose(carousel, isC, initialFrontFacing)
    const scale = (isC ? CENTER_SCALE : SIDE_SCALE) * layout.fit
    const depth = isC ? 0.45 : -0.85
    outer.current.visible = initiallyVisible && !progressive
    centerStatusRef.current = initiallyVisible && isC
    setShowCenterStatus(initiallyVisible && isC)
    outer.current.position.set(
      off * layout.spacing,
      bottomAlignedY(camera, corners, scale, depth, initialPose.pitch, faceRotation + initialPose.yaw, initialPose.roll) - (active ? 0 : 1.7),
      depth,
    )
    outer.current.scale.setScalar((isC ? CENTER_SCALE : SIDE_SCALE) * layout.fit)
    rot.current.pitch = initialPose.pitch
    rot.current.yaw = initialPose.yaw
    rot.current.roll = initialPose.roll
    uscale.current = outer.current.scale.x
    reveal.current = outer.current.visible ? 1 : 0
    prevY.current = outer.current.position.y
    previousOffset.current = off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <group
      ref={outer}
      {...inspection.events}
      onClick={(e) => {
        e.stopPropagation()
        if (performance.now() < (carousel.suppressClickUntil || 0)) return
        if (carousel.platform !== platformIndex || carousel.drawerOpen) return
        const selectedPosition = selectedPositionForCarousel(carousel, platformIndex)
        if (offsetForCarousel(index - selectedPosition, count, carousel.loopMode) === 0) onLaunch()
        else onPick(gameIndex, index)
      }}
      onPointerOver={() => { if (!inspection.dragging()) document.body.style.cursor = carousel.drawerOpen ? 'grab' : 'pointer' }}
      onPointerOut={() => { if (!inspection.dragging()) document.body.style.cursor = 'auto' }}
    >
      <group ref={inner} scale={normScale}>
        <group rotation={modelRotation}><group position={modelOffset}>
          {parts.map((part, partIndex) => (
            <mesh
              key={partIndex}
              geometry={part.geometry}
              material={resolvedMaterials[partIndex]}
              matrix={part.matrix}
              matrixAutoUpdate={false}
              dispose={null}
            />
          ))}
        </group></group>
      </group>
      {showCenterStatus && statusPhase !== 'hidden' && (
        <Html position={[0.82, 0.85, 0]} center distanceFactor={8} zIndexRange={[20, 0]}>
          <div
            className={`art-status art-status-${fetchState}${
              statusPhase === 'fading' ? ' art-status-fade-out' : ''
            }`}
            title={artStatus?.message || `Label art ${fetchState}`}
            aria-label={artStatus?.message || `Label art ${fetchState}`}
          >
            <span className="art-status-icon">{fetchIcon}</span>
            <span>{fetchLabel}</span>
          </div>
        </Html>
      )}
    </group>
  )
})

function wrapOffset(rawOffset, count) {
  return rawOffset - Math.round(rawOffset / count) * count
}

function offsetForCarousel(rawOffset, count, loopMode = 'jump') {
  return loopMode === 'off' ? rawOffset : wrapOffset(rawOffset, count)
}

function selectedPositionForCarousel(carousel, platformIndex) {
  if (carousel.loopMode === 'seamless') {
    return carousel.virtualSelected?.[platformIndex] ?? carousel.selected[platformIndex]
  }
  return carousel.selected[platformIndex]
}

// Eases the camera's zoom toward carousel.zoom (the "3D scale" setting):
// zoom > 1 gets closer/bigger, zoom < 1 pulls back for a wider scene.
function CameraRig({ carousel }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => { carousel.reducedMotion = media.matches }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [carousel])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const targetZoom = carousel.zoom || 1
    const targetX = carousel.drawerOpen ? Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect * 0.43 / camera.zoom : 0
    const cameraEase = carousel.reducedMotion ? 1 : 1 - Math.pow(0.0008, dt)
    camera.position.x += (targetX - camera.position.x) * cameraEase
    camera.lookAt(camera.position.x, 0.15, 0)
    if (Math.abs(camera.zoom - targetZoom) >= 0.001) {
      camera.zoom += (targetZoom - camera.zoom) * (1 - Math.pow(0.002, dt))
      camera.updateProjectionMatrix()
    }
  })
  return null
}

const ZERO_ROTATION = [0, 0, 0]

function PlatformShelf({
  platform,
  platformIndex,
  activePlatform,
  artMap,
  artStatus,
  gamePrefs,
  carousel,
  loopMode,
  onPick,
  onLaunch,
  fallbackLabel,
  textureQueue,
  onReady,
}) {
  const { scene } = useGLTF(platform.model.url)
  const mapEntries = useMemo(() => Object.entries(platform.model.shellMaps || {}), [platform.model])
  const restoredTextures = useLoader(THREE.TextureLoader, mapEntries.map(([, url]) => url))
  const restoredMaps = useMemo(() => Object.fromEntries(mapEntries.map(([name], index) => [name, restoredTextures[index]])), [mapEntries, restoredTextures])
  const materialMapEntries = useMemo(() => {
    const entries = []
    Object.entries(platform.model.materialMaps || {}).forEach(([materialName, spec]) => {
      const slots = typeof spec === 'string' ? { map: spec } : spec
      Object.entries(slots || {}).forEach(([slot, url]) => {
        if (url) entries.push([materialName.toLowerCase(), slot, url])
      })
    })
    return entries
  }, [platform.model])
  const materialTextures = useLoader(THREE.TextureLoader, materialMapEntries.map(([, , url]) => url))
  const restoredMaterialMaps = useMemo(() => {
    const result = {}
    materialMapEntries.forEach(([materialName, slot], index) => {
      if (!result[materialName]) result[materialName] = {}
      result[materialName][slot] = materialTextures[index]
    })
    return result
  }, [materialMapEntries, materialTextures])
  const [mapsReady, setMapsReady] = useState(mapEntries.length === 0)
  useEffect(() => {
    let alive = true
    if (!mapEntries.length) return
    let uploaded = 0
    mapEntries.forEach(([name], index) => {
      const texture = restoredTextures[index]
      // Match glTF's V origin and the reference repeating sampler. Several shell
      // UV islands extend past 1; clamping smears the atlas edge over them.
      texture.flipY = false
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.colorSpace = name === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.userData.panoplyRGNormal = name === 'normalMap'
      texture.anisotropy = 8
      texture.needsUpdate = true
      textureQueue.push((gl) => {
        if (!alive) return
        gl.initTexture(texture)
        uploaded += 1
        if (uploaded === mapEntries.length) setMapsReady(true)
      })
    })
    return () => { alive = false }
  }, [mapEntries, restoredTextures, textureQueue])
  useEffect(() => {
    materialMapEntries.forEach(([materialName, slot], index) => {
      const texture = materialTextures[index]
      if (!texture) return
      texture.flipY = false
      texture.colorSpace = slot === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.anisotropy = 8
      texture.needsUpdate = true
      textureQueue.push((gl) => gl.initTexture(texture))
    })
  }, [materialMapEntries, materialTextures, textureQueue])
  const prepared = useMemo(
    () => prepareModel(scene, platform.model, restoredMaterialMaps),
    [scene, platform.model, restoredMaterialMaps],
  )
  const gameCount = platform.games.length
  const slotCount = loopMode === 'seamless' ? seamlessCarouselSlotCount(gameCount) : gameCount
  const firstIndex = carousel.selected[platformIndex]
  const selectedVirtual = carousel.virtualSelected?.[platformIndex] ?? firstIndex
  const firstSlot = loopMode === 'seamless' ? ((selectedVirtual % slotCount) + slotCount) % slotCount : firstIndex
  const slots = useMemo(() => Array.from({ length: slotCount }, (_, slotIndex) => slotIndex), [slotCount])
  const [mountedSlots, setMountedSlots] = useState(() => new Set([firstSlot]))

  useEffect(() => {
    if (mapsReady && platformIndex === activePlatform) onReady?.()
  }, [activePlatform, onReady, platformIndex, mapsReady])

  useEffect(() => {
    setMountedSlots((current) => {
      if (current.has(firstSlot)) return current
      const next = new Set(current)
      next.add(firstSlot)
      return next
    })
    const priority = slots
      .filter((index) => index !== firstSlot)
      .sort((left, right) => {
        const leftDistance = Math.abs(offsetForCarousel(left - firstSlot, slotCount, loopMode))
        const rightDistance = Math.abs(offsetForCarousel(right - firstSlot, slotCount, loopMode))
        return leftDistance - rightDistance || left - right
      })
    let timer
    let cursor = 0
    const mountNext = () => {
      if (cursor >= priority.length) return
      const index = priority[cursor]
      cursor += 1
      setMountedSlots((current) => {
        const next = new Set(current)
        next.add(index)
        return next
      })
      timer = setTimeout(mountNext, cursor < 5 ? 72 : 115)
    }
    timer = setTimeout(mountNext, 65)
    return () => clearTimeout(timer)
  }, [firstSlot, loopMode, slotCount, slots])

  if (!mapsReady) return null
  return slots.map((slotIndex) => {
    if (!mountedSlots.has(slotIndex)) return null
    const gameIndex = slotIndex % gameCount
    const game = platform.games[gameIndex]
    const key = `${platform.id}:${game.title}`
    return (
      <Cartridge
        key={loopMode === 'seamless' ? `${key}:slot-${slotIndex}` : key}
        platformIndex={platformIndex}
        index={slotIndex}
        gameIndex={gameIndex}
        count={slotCount}
        carousel={carousel}
        artUrl={artMap[key] || null}
        artStatus={artStatus[key]}
        appearance={gamePrefs[key] || EMPTY_APPEARANCE}
        onPick={onPick}
        onLaunch={onLaunch}
        parts={prepared.parts}
        modelOffset={prepared.modelOffset}
        normScale={prepared.normScale}
        corners={prepared.corners}
        modelRotation={platform.model.rotation || ZERO_ROTATION}
        faceRotation={platform.model.faceRotation ?? MODEL_ROT_Y}
        shellTextures={mapEntries.length ? restoredMaps : null}
        shellColor={platform.model.shellColor}
        preserveInnerMaterials={platform.model.preserveInnerMaterials}
        fallbackLabel={fallbackLabel}
        textureQueue={textureQueue}
        progressive={slotIndex !== firstSlot}
      />
    )
  })
}

function SceneContents({
  platforms,
  activePlatform,
  artMap,
  artStatus,
  gamePrefs,
  carousel,
  loopMode,
  onPick,
  onLaunch,
  desktop,
  onReady,
}) {
  const gl = useThree((state) => state.gl)
  const worldScene = useThree((state) => state.scene)
  const fallbackLabel = useTexture(FALLBACK_LABEL)
  const textureQueue = useMemo(() => [], [])
  const [visited, setVisited] = useState(() => new Set([activePlatform]))
  const [environmentReady, setEnvironmentReady] = useState(false)

  useEffect(() => {
    // A local studio environment gives metals something to reflect. No HDR download.
    let alive = true
    let target
    const previous = worldScene.environment
    textureQueue.push((renderer) => {
      if (!alive) return
      const room = new RoomEnvironment()
      const generator = new THREE.PMREMGenerator(renderer)
      target = generator.fromScene(room, 0.04)
      worldScene.environment = target.texture
      room.dispose()
      generator.dispose()
      setEnvironmentReady(true)
    })
    return () => {
      alive = false
      if (target && worldScene.environment === target.texture) worldScene.environment = previous
      target?.dispose()
    }
  }, [textureQueue, worldScene])

  useLayoutEffect(() => {
    fallbackLabel.flipY = false
    fallbackLabel.colorSpace = THREE.SRGBColorSpace
    fallbackLabel.anisotropy = 8
    fallbackLabel.needsUpdate = true
    gl.initTexture(fallbackLabel)
  }, [fallbackLabel, gl])

  useEffect(() => {
    setVisited((current) => {
      if (current.has(activePlatform)) return current
      const next = new Set(current)
      next.add(activePlatform)
      return next
    })

    const nextPlatform = platforms[(activePlatform + 1) % platforms.length]
    const preload = () => useGLTF.preload(nextPlatform.model.url)
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 1500 })
      return () => window.cancelIdleCallback(idleId)
    }
    const timerId = setTimeout(preload, 500)
    return () => clearTimeout(timerId)
  }, [activePlatform, platforms])

  const rendered = new Set(visited)
  rendered.add(activePlatform)

  return (
    <>
      <TextureWarmup queue={textureQueue} />
      {environmentReady && [...rendered].map((platformIndex) => (
        <Suspense key={platforms[platformIndex].id} fallback={null}>
          <PlatformShelf
            platform={platforms[platformIndex]}
            platformIndex={platformIndex}
            activePlatform={activePlatform}
            artMap={artMap}
            artStatus={artStatus}
            gamePrefs={gamePrefs}
            carousel={carousel}
            loopMode={loopMode}
            onPick={onPick}
            onLaunch={onLaunch}
            fallbackLabel={fallbackLabel}
            textureQueue={textureQueue}
            onReady={onReady}
          />
        </Suspense>
      ))}
    </>
  )
}

// memo + mutable carousel store: after label art has loaded, this component
// never re-renders again. Arrow presses only touch the frame loop.
const Scene = memo(function Scene({
  platforms,
  activePlatform,
  artMap,
  artStatus,
  gamePrefs,
  carousel,
  loopMode,
  onPick,
  onLaunch,
  desktop,
  onReady,
  lighting = 1,
  touchHandlers,
}) {
  return (
    <div className="scene-touch-surface" {...touchHandlers}>
      <Canvas
        className="scene-canvas"
        gl={{ alpha: true, antialias: true }}
        dpr={desktop ? [1, 2] : [1, 1.6]}
        camera={{ position: [0, 0.15, 7.4], fov: 35 }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <CameraRig carousel={carousel} />
        <SceneLighting carousel={carousel} multiplier={lighting} />
        <Suspense fallback={null}>
          <SceneContents
            platforms={platforms}
            activePlatform={activePlatform}
            artMap={artMap}
            artStatus={artStatus}
            gamePrefs={gamePrefs}
            carousel={carousel}
            loopMode={loopMode}
            onPick={onPick}
            onLaunch={onLaunch}
            desktop={desktop}
            onReady={onReady}
          />
        </Suspense>
      </Canvas>
    </div>
  )
})

export default Scene
