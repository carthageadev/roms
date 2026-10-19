![Banner](banner.webp)

## Home: cartridge line

The home page is one screen with no scrolling. Twelve cartridges sit in a staggered line that drifts along on its own, pausing on each one: N64, Game Boy Advance, Nintendo DS and Switch, three of each, shuffled per visit. Each cartridge wears a favourite title from its system, printed on the plastic as the sticker it really shipped with. The one in the centre is the one named underneath.

- Everything else was removed for now: browsing, search, platforms and filters are gone, and lists are the only feature.
- Navigation is a single dim point in the corner (src/components/ZenGate.tsx). It breathes slowly; opening it fades the page away behind two enormous words, Home and Lists. There is no bar and no logo.
- Source: the Panoply cartridge code (src/three/Scene.jsx, labelFoil.js, useInspectRotation.js, src/lib/carouselPrefs.js) and its four cartridge models and textures (public/models, public/textures, public/draco). src/three/CartridgeLine.jsx is the line layout built on those helpers.
- Browse by drag, the arrow buttons, or the arrow keys. Clicking does not select a cartridge. With prefers-reduced-motion the line only moves when it is asked to.
- The 3D code is a separate chunk. Each cartridge fades in once its model and label texture are ready.
- Labels: public/images/labels holds one real sticker per title, fetched from ScreenScraper's support-texture (the artwork printed on the cart, which is what Panoply puts on its models) and laid into the exact window of the texture each model's UVs sample - labelFace in src/data/lineup.json, measured off the GLBs. Nothing is stretched and nothing is cut off. The sixteen box art covers in public/images/covers come from the same script in catalog mode. node scripts/fetch-covers.mjs refreshes both (--force, --only=<id>, --set=labels); it verifies the console and the title of every match before writing, so a same-titled game from another system is rejected. GET /api/cover?title= resolves a title the same way at runtime.
- src/three/** is excluded from lint because Three.js mutates objects in the frame loop by design.
- scripts/smoke-test.mjs drives the real app in a browser, WebGL included. Run it against a running server: PREVIEW_URL=https://your-host node scripts/smoke-test.mjs