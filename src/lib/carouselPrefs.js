export const DEFAULT_CAROUSEL_SPACING = 1
export const CAROUSEL_SPACING_MIN = 0.7
export const CAROUSEL_SPACING_MAX = 1.4
export const CAROUSEL_LOOP_MODES = Object.freeze([
  { id: 'off', label: 'Off' },
  { id: 'jump', label: 'Jump' },
  { id: 'seamless', label: 'Seamless' },
])
export const DEFAULT_CAROUSEL_LOOP_MODE = 'seamless'
export const SEAMLESS_MIN_SLOTS = 7
export const CAROUSEL_TRANSITION_TYPES = Object.freeze([
  { id: 'default', label: 'Default' },
  { id: 'normal', label: 'Normal' },
  { id: 'swing', label: 'Swing' },
])
export const DEFAULT_TRANSITION_TYPE = 'default'
// Shared tuned pose used by the built-in Tilted preset and new custom poses.
export const DEFAULT_TILTED_POSE = Object.freeze({ pitch: -0.27, yaw: 0.42, roll: 0 })
export const DEFAULT_CUSTOM_POSE = DEFAULT_TILTED_POSE
export const DEFAULT_CUSTOM_POSE_NAME = 'Custom tilt'
export const LIGHT_STRENGTH_MIN = 0
export const LIGHT_STRENGTH_MAX = 2.5
export const DEFAULT_LIGHTING_PROFILE = Object.freeze({
  ambient: 0.65,
  key: 1.6,
  fill: 0.5,
  rim: 0.25,
  keyPosition: Object.freeze({ x: 4, y: 5, z: 6 }),
})
export const FLOAT_LEVELS = Object.freeze([
  { id: 'off', label: 'Off', value: 0 },
  { id: 'light', label: 'Light', value: 0.35 },
  { id: 'medium', label: 'Medium', value: 0.7 },
  { id: 'strong', label: 'Strong', value: 1.15 },
])
export const DEFAULT_FLOAT_SETTINGS = Object.freeze({ enabled: true, center: 'medium', sides: 'light' })

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

export function clampCarouselSpacing(value) {
  return clamp(Number(value), CAROUSEL_SPACING_MIN, CAROUSEL_SPACING_MAX, DEFAULT_CAROUSEL_SPACING)
}

export function normalizeCarouselLoopMode(value) {
  if (CAROUSEL_LOOP_MODES.some((mode) => mode.id === value)) return value
  if (value === 'on') return 'jump'
  return DEFAULT_CAROUSEL_LOOP_MODE
}

export function seamlessCarouselSlotCount(gameCount) {
  const count = Math.max(1, Math.floor(Number(gameCount) || 1))
  return count * Math.max(1, Math.ceil(SEAMLESS_MIN_SLOTS / count))
}

export function normalizeTransitionType(value) {
  return CAROUSEL_TRANSITION_TYPES.some((type) => type.id === value) ? value : DEFAULT_TRANSITION_TYPE
}

export function normalizeCustomPose(value) {
  return {
    pitch: clamp(Number(value?.pitch), -0.85, 0.85, DEFAULT_CUSTOM_POSE.pitch),
    yaw: clamp(Number(value?.yaw), -1.2, 1.2, DEFAULT_CUSTOM_POSE.yaw),
    roll: clamp(Number(value?.roll), -0.85, 0.85, DEFAULT_CUSTOM_POSE.roll),
  }
}

export function normalizeLightingProfile(value) {
  const keyPosition = value?.keyPosition || {}
  return {
    ambient: clamp(Number(value?.ambient), LIGHT_STRENGTH_MIN, LIGHT_STRENGTH_MAX, DEFAULT_LIGHTING_PROFILE.ambient),
    key: clamp(Number(value?.key), LIGHT_STRENGTH_MIN, LIGHT_STRENGTH_MAX, DEFAULT_LIGHTING_PROFILE.key),
    fill: clamp(Number(value?.fill), LIGHT_STRENGTH_MIN, LIGHT_STRENGTH_MAX, DEFAULT_LIGHTING_PROFILE.fill),
    rim: clamp(Number(value?.rim), LIGHT_STRENGTH_MIN, LIGHT_STRENGTH_MAX, DEFAULT_LIGHTING_PROFILE.rim),
    keyPosition: {
      x: clamp(Number(keyPosition.x), -8, 8, DEFAULT_LIGHTING_PROFILE.keyPosition.x),
      y: clamp(Number(keyPosition.y), -8, 8, DEFAULT_LIGHTING_PROFILE.keyPosition.y),
      z: clamp(Number(keyPosition.z), 2, 10, DEFAULT_LIGHTING_PROFILE.keyPosition.z),
    },
  }
}
