# ROMS TN

Terminal-style ROM index and search frontend for [roms.tn](https://roms.tn).

This app does **not** run a scraper and does **not** commit a ROM list. It consumes the same weekly Atlas build at runtime:

- `https://carthageadev.github.io/atlas/data/meta.json`
- `https://carthageadev.github.io/atlas/data/roms.json.gz`

The frontend downloads and decompresses the shared index in the browser, then searches it locally. Plain text searches titles, companies, systems, and paths. Filters include `p:n64`, `c:nintendo`, and `y:199x`.

## Run locally

```bash
bun install
bun run dev
```

To point the app at a different published index, set `VITE_ATLAS_DATA_URL` before starting Vite.

The previous premium landing-page frontend is preserved on the `legacy` branch. `main` contains the terminal frontend.
