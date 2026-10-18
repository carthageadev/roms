roms.tn (Next.js)

## Home: cartridge ring

The home page shows twelve cartridges orbiting a tilted ring: N64, Game Boy Advance, 3DS and Switch, three of each, shuffled per visit. Each cartridge wears a random favourite title and a random shell finish and casing tint.

- Source: the Panoply cartridge code (src/three/Scene.jsx, labelFoil.js, useInspectRotation.js, src/lib/carouselPrefs.js) and its four cartridge models and textures (public/models, public/textures, public/draco). src/three/CartridgeRing.jsx is the new ring layout built on those helpers.
- Browse by vertical drag, scroll wheel, the arrow buttons, or the arrow keys. Clicking does not select a cartridge.
- The 3D code is a separate chunk. Each cartridge fades in once its model and label texture are ready.
- Box art: GET /api/cover?title= resolves a title through ScreenScraper (server-side, cached per title). Without SCREENSCRAPER_* keys, or when a lookup fails, the cartridge keeps its generated label.
- src/three/** is excluded from lint because Three.js mutates objects in the frame loop by design.