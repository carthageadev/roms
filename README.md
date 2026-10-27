![Banner](banner.webp)

## Home: physical cartridge archive

The home page is a dark, minimal coming-soon page for an archive of the physical details of game cartridges. Access is closed; the status button does not collect requests or sign anyone up.

- One Game Boy Advance cartridge floats in the centre. Its model, textures, studio lighting and locally stored Metroid Fusion sticker come from the existing Panoply-based assets.
- The cartridge responds gently to the mouse and, on supported phones, relative device orientation. iOS asks for motion permission only when the visitor selects **Enable phone tilt**; a denied or unavailable sensor leaves the page usable. Reduced-motion preferences disable the float and input movement.
- The 3D view is a separate chunk. The home page does not query the database, fetch artwork from a remote service, or show the old lists interface. Existing API routes and data remain in the repository.
- `scripts/fetch-covers.mjs` can refresh local labels and covers (`--force`, `--only=<id>`, `--set=labels`). `src/three/**` is excluded from lint because Three.js mutates objects in the frame loop.
- `scripts/smoke-test.mjs` checks the page in a real browser, including WebGL, pointer and simulated phone motion, permissions, reduced motion, and desktop/mobile layouts. Run it against a running server with `PREVIEW_URL=https://your-host node scripts/smoke-test.mjs`. Install Playwright's Chromium, or set `PLAYWRIGHT_CHANNEL=chrome` to use local Chrome.
