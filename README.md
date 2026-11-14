![Banner](banner.webp)

## Home: physical cartridge archive

The home page is a dark, minimal coming-soon page for an archive of the physical details of game cartridges.

- One cartridge is drawn per visit from a flat pool across Game Boy Advance, Nintendo DS, Super Nintendo and NES, so every game has the same chance. The two gold Zelda NES Game Paks sit in that same pool, with the gold shell maps and their own labels. Only the chosen system's shell, skin and one locally stored label are downloaded.
- The stage uses MSAA and FXAA, with a warm key from the left, a cool fill and a back rim, so the cartridge reads in relief against the dark page.
- The cartridge responds gently to the mouse and, on supported phones, relative device orientation. iOS asks for motion permission only when the visitor selects **Move with your phone**; a denied or unavailable sensor leaves the page usable. Reduced-motion preferences disable the float and input movement.
- The 3D view is a separate chunk. The home page does not query the database, fetch artwork from a remote service, or show the old lists interface. Existing API routes and data remain in the repository.
- `scripts/fetch-covers.mjs` can refresh local labels and covers (`--force`, `--only=<id>`, `--set=labels`). `src/three/**` is excluded from lint because Three.js mutates objects in the frame loop.
- `scripts/smoke-test.mjs` checks the page in a real browser, including WebGL, pointer and simulated phone motion, permissions, reduced motion, and desktop/mobile layouts. Run it against a running server with `PREVIEW_URL=https://your-host node scripts/smoke-test.mjs`. Install Playwright's Chromium, or set `PLAYWRIGHT_CHANNEL=chrome` to use local Chrome.
