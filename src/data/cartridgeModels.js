// Cartridge model configs copied from Panoply's src/data/games.js (N64, GBA, 3DS, Switch).
// Only the model definitions are kept; the carousel shelves are not used here.

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
  '3ds': model('/models/3ds/cartridge.glb', ['Game Cart_001'], {
    rotation: [-Math.PI / 2, Math.PI, 0],
    hiddenMaterials: ['Cover'],
    shellMaterials: ['Light Gray Plastic', 'Light Gray Plastic.001'],
    innerMaterials: ['Gold Contacts', 'Green Plastic'],
    preserveInnerMaterials: true,
    shellMaps: {
      map: '/textures/3ds/base-color.jpg',
      normalMap: '/textures/3ds/normal.jpg',
    },
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

export const PLATFORM_ORDER = ['n64', 'gba', '3ds', 'switch']

export const RING_SIZE = 12

export const PLATFORM_NAMES = {
  n64: 'Nintendo 64',
  gba: 'Game Boy Advance',
  '3ds': 'Nintendo 3DS',
  switch: 'Nintendo Switch',
}

// Favourite titles per system. Each cartridge wears one of these labels at random.
export const FAVORITE_TITLES = {
  n64: ['Super Mario 64', 'The Legend of Zelda: Ocarina of Time', 'GoldenEye 007'],
  gba: ['Metroid Fusion', 'Pokemon Emerald', 'The Legend of Zelda: The Minish Cap'],
  '3ds': ['Mario Kart 7', 'Pokemon X', 'The Legend of Zelda: A Link Between Worlds'],
  switch: ['The Legend of Zelda: Breath of the Wild', 'Super Mario Odyssey', 'Mario Kart 8 Deluxe'],
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// A fresh random ring each visit: shuffled system order, a random favourite
// per cartridge, and a random shell finish, casing tint and float phase.
export function buildRing() {
  const finishes = ['default', 'translucent', 'glitter', 'metallic']
  const casings = [null, '#e6ebf2', '#f1dccb', '#d2e4d6', '#2b2f37', '#d8cbee']
  const perSystem = RING_SIZE / PLATFORM_ORDER.length
  const platforms = shuffle(PLATFORM_ORDER.flatMap((platform) => Array(perSystem).fill(platform)))
  return platforms.map((platform, index) => ({
    id: `${platform}-${index}`,
    platform,
    platformName: PLATFORM_NAMES[platform],
    title: pick(FAVORITE_TITLES[platform]),
    finish: pick(finishes),
    casing: pick(casings),
    phase: Math.random() * Math.PI * 2,
  }))
}
