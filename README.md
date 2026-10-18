roms.tn (Next.js)

## Home: cartridge line

The home page is one screen with no scrolling. Twelve cartridges sit in a staggered line that drifts along on its own, pausing on each one: N64, Game Boy Advance, 3DS and Switch, three of each, shuffled per visit. Each cartridge wears a random favourite title and a random shell finish and casing tint. The one in the centre is the one named underneath.

- Everything else was removed for now: browsing, search, platforms and filters are gone, and lists are the only feature.
- Source: the Panoply cartridge code (src/three/Scene.jsx, labelFoil.js, useInspectRotation.js, src/lib/carouselPrefs.js) and its four cartridge models and textures (public/models, public/textures, public/draco). src/three/CartridgeLine.jsx is the line layout built on those helpers.
- Browse by drag, the arrow buttons, or the arrow keys. Clicking does not select a cartridge. With prefers-reduced-motion the line only moves when it is asked to.
- The 3D code is a separate chunk. Each cartridge fades in once its model and label texture are ready.
- Box art: GET /api/cover?title= resolves a title through ScreenScraper (server-side, cached per title). Without SCREENSCRAPER_* keys, or when a lookup fails, the cartridge keeps its generated label.
- src/three/** is excluded from lint because Three.js mutates objects in the frame loop by design.
- scripts/smoke-test.mjs drives the real app in a browser, WebGL included. Run it against a running server: PREVIEW_URL=https://your-host node scripts/smoke-test.mjs