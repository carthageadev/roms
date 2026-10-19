// Cartridge model configs copied from Panoply's src/data/games.js (N64, GBA, DS,
// Switch). Only the model definitions are kept; the carousel shelves are not
// used here. The models and textures are byte-identical to Panoply's.
import lineup from './lineup.json'

const model = (url, labelNodes, options = {}) => ({ url, labelNodes, ...options })

const shellMaps = (folder, ao = null, extras = {}) => ({
  map: `/textures/${folder}/base-color.png`,
  normalMap: `/textures/${folder}/normal.png`,
  roughnessMap: `/textures/${folder}/roughness.png`,
  metalnessMap: `/textures/${folder}/metallic.png`,
  ...(ao ? { aoMap: `/textures/${folder}/${ao}.png` } : {}),
  ...extras,
})

export const MODELS = {
  n64: model('/models/n64/cartridge.glb', [], {
    shellMaterials: ['Material.001'],
    labelMaterials: ['LogoMaterial'],
    shellMaps: shellMaps('n64', 'ambient-occlusion'),
    faceRotation: 0,
  }),
  gba: model('/models/gba/cartridge.glb', [], {
    labelMaterials: ['cover'],
    shellMaterials: ['lambert1'],
    innerMaterials: ['insides'],
    shellMaps: shellMaps('gba', 'ambient-occlusion'),
    rotation: [-Math.PI / 2, 0, 0],
  }),
  nds: model('/models/nds/cartridge.glb', ['defaultMaterial_002'], {
    shellNodes: ['defaultMaterial_001'],
    shellMaterials: ['DefaultMaterial'],
    shellMaps: {
      map: '/textures/nds/base-color.jpg',
      normalMap: '/textures/nds/normal.png',
      roughnessMap: '/textures/nds/metallic-roughness.png',
      metalnessMap: '/textures/nds/metallic-roughness.png',
    },
    faceRotation: 0,
  }),
  switch: model('/models/switch/cartridge.glb', ['Case_001'], {
    shellNodes: ['Case'],
    innerNodes: ['CircuitBoard'],
    shellMaps: {
      ...shellMaps('switch'),
      map: '/textures/switch/base-color.png',
      aoMap: '/textures/switch/ambient-occlusion.png',
    },
  }),
}

export const PLATFORM_ORDER = ['n64', 'gba', 'nds', 'switch']

export const LINEUP_SIZE = 12

export const PLATFORM_NAMES = {
  n64: 'Nintendo 64',
  gba: 'Game Boy Advance',
  nds: 'Nintendo DS',
  switch: 'Nintendo Switch',
}

// Favourite titles per system. Each cartridge wears one of these labels at
// random. The covers are real box art baked into public/images/labels, cropped
// to the label's own aspect ratio so nothing is stretched on the cartridge.
export const LINEUP_TITLES = lineup.titles

// Each model's label mesh only samples part of its texture (the n64 reads the
// middle 85% of the width) and its face is a different shape again, so the art
// has to be authored at the aspect the mesh actually wants: face aspect times
// the v window over the u window. scripts/fetch-covers.mjs bakes to this and the
// generated fallback art is drawn at it too.
const LABEL_FACE = lineup.labelFace

export const LABEL_ASPECT = Object.fromEntries(
  Object.entries(LABEL_FACE).map(([platform, face]) => [
    platform,
    face.aspect * ((face.v[1] - face.v[0]) / (face.u[1] - face.u[0])),
  ]),
)

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const between = (min, max) => min + Math.random() * (max - min)

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// A staggered lineup, reshuffled every visit: a random system order, a random
// favourite per cartridge, and a random height and tilt.
// `row` alternates the height so the line reads as staggered, not straight.
export function buildLineup() {
  const perSystem = LINEUP_SIZE / PLATFORM_ORDER.length
  const platforms = shuffle(PLATFORM_ORDER.flatMap((platform) => Array(perSystem).fill(platform)))
  return platforms.map((platform, index) => {
    const choices = LINEUP_TITLES[platform] ?? []
    const favourite = choices.length ? pick(choices) : null
    return {
      id: `${platform}-${index}`,
      platform,
      platformName: PLATFORM_NAMES[platform],
      title: favourite?.title ?? PLATFORM_NAMES[platform],
      cover: favourite?.cover ?? null,
      row: index % 2 === 0 ? 1 : -1,
      depth: (index % 3) - 1,
      lift: between(-0.14, 0.14),
      tilt: between(-0.05, 0.05),
      phase: Math.random() * Math.PI * 2,
    }
  })
}
