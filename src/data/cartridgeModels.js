// Cartridge model configs copied from Panoply's src/data/games.js (N64, GBA, DS,
// Switch, SNES). Only the model definitions are kept; the carousel shelves are
// not used here. Shells are repacked and their maps lightened for the web.
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
  snes: model('/models/snes/cartridge.glb', ['Label'], {
    // The newer US shell from Panoply: a separate label, the black strip over
    // the top edge, and the board inside. Only the front label is replaced.
    shellNodes: ['Shell'],
    innerNodes: ['Board'],
    preserveInnerMaterials: true,
    faceRotation: 0,
    // The model's maps carry its plastic's polish, so the shell values scale
    // them: at 1.8 the grain reads as satin rather than glitter.
    shellFinish: { roughness: 1.8, metalness: 1 },
    shellMaps: {
      map: '/textures/snes/base-color.webp',
      normalMap: '/textures/snes/normal.webp',
      roughnessMap: '/textures/snes/mr.webp',
      metalnessMap: '/textures/snes/mr.webp',
    },
    // The mask keeps screws, stickers and contacts in their own colours while
    // the plastic takes the shell grey.
    plasticMask: '/textures/snes/plastic-mask.png',
    albedoRef: '#757381',
    shellColor: '#a7a599',
    // The label mesh samples this window of the shell atlas rather than the
    // whole texture, so the label material maps it back to the full face.
    labelUv: { u: [0.004906, 0.339399], v: [0.230855, 0.381595] },
  }),
  nes: model('/models/nes/cartridge.glb', ['Label'], {
    // Panoply's full NES shell: a separate front label, the paper back, the
    // foil caution sticker, the board edge and the screws. The board keeps its
    // own maps; the shell takes one of the two skins below.
    shellNodes: ['Shell'],
    innerNodes: ['BoardEdge', 'Board', 'Parts', 'Legs'],
    preserveInnerMaterials: true,
    // The maps carry the plastic's polish (and the gold's metal), so these
    // values scale them rather than replacing them.
    shellFinish: {
      roughness: 0.78,
      metalness: 1,
      normalStrength: 1.14,
      clearcoat: 0.3,
      clearcoatRoughness: 0.61,
    },
    shellMaps: {
      map: '/textures/nes/base-color.webp',
      normalMap: '/textures/nes/normal.webp',
      roughnessMap: '/textures/nes/mr.png',
      metalnessMap: '/textures/nes/mr.png',
    },
    // The special Zelda carts are the real gold Game Paks, not a tinted grey
    // shell. Only the chosen skin's maps are requested.
    variants: {
      gold: {
        shellMaps: {
          map: '/textures/nes/gold/base-color.webp',
          normalMap: '/textures/nes/gold/normal.webp',
          roughnessMap: '/textures/nes/gold/mr.webp',
          metalnessMap: '/textures/nes/gold/mr.webp',
        },
        shellFinish: {
          roughness: 1.1,
          metalness: 1,
          normalStrength: 1,
          clearcoat: 0,
          envIntensity: 0.7,
        },
        look: { tint: '#f3f5fb', brightness: 0.6, clearcoat: 0 },
      },
    },
  }),
}

export const PLATFORM_ORDER = ['n64', 'gba', 'nds', 'switch']

// One cartridge at a time on the home page, a different system per visit.
// The games behind these are the ones whose labels already live in
// public/images/labels, so a visit only ever downloads one model and one label.
export const SHOWCASE_PLATFORMS = ['gba', 'nds', 'snes', 'nes']

// A visit that draws the NES can instead draw one of its gold Zelda Game
// Paks. The chance is rolled once, after the platform, and only systems with
// specials take part, so every other system still draws exactly one game.
export const SPECIAL_SPAWN_CHANCE = 0.35
export const SHOWCASE_SPECIALS = {
  nes: [
    { title: 'The Legend of Zelda', cover: '/images/labels/zelda-gold.png', variant: 'gold' },
    { title: 'Zelda II: The Adventure of Link', cover: '/images/labels/zelda-ii-gold.png', variant: 'gold' },
  ],
}

export const LINEUP_SIZE = 12

export const PLATFORM_NAMES = {
  n64: 'Nintendo 64',
  gba: 'Game Boy Advance',
  nds: 'Nintendo DS',
  switch: 'Nintendo Switch',
  snes: 'Super Nintendo',
  nes: 'Nintendo Entertainment System',
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
