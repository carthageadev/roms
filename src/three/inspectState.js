import * as THREE from 'three'

// Live label fit, driven by the inspect panel. The label shader multiplies the
// mapped UV by `repeat` and then adds `offset`, so the art can be nudged and
// rescaled on the mesh without editing any file.
export const LABEL_FIT = {
  offset: new THREE.Vector2(0, 0),
  repeat: new THREE.Vector2(1, 1),
}

// Mutable bridge between the DOM Leva panel and the three.js scene. The scene
// reads this every frame, so the panel never has to re-render the canvas.
export const INSPECT = {
  active: false,
  orbit: true,
  autoRotate: false,
  freeze: true,
  wireframe: false,
  checker: false,
  art: null,
  allMaterials: [],
  labelTexture: null,
  checkerTexture: null,
}

// A labelled grid: the corner squares and the red border make any stretch or
// crop obvious at a glance, the same way the baked checker test did.
export function makeCheckerTexture() {
  const size = 512
  const cells = 8
  const step = size / cells
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#7a7a7a'
      ctx.fillRect(x * step, y * step, step, step)
    }
  }
  ctx.strokeStyle = '#ff2d2d'
  ctx.lineWidth = 10
  ctx.strokeRect(0, 0, size, size)
  const corners = ['#00ff66', '#2d6bff', '#ffe14d', '#ff4df0']
  const spots = [
    [0, 0],
    [size - step, 0],
    [0, size - step],
    [size - step, size - step],
  ]
  spots.forEach(([x, y], i) => {
    ctx.fillStyle = corners[i]
    ctx.fillRect(x, y, step, step)
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.flipY = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}