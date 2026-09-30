# roms.tn (Next.js)

Minimalist ROM discovery platform: discover timeless classics, save favorites, and build retro collections.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- Postgres (Neon) via Drizzle ORM — saves and collections are server-side, keyed by a private visitor cookie
- Seed catalog of 16 classics in `src/lib/catalog.ts` (`ensureCatalog` seeds on first request)

## Setup

```bash
bun install
```

Create `.env.local` (gitignored, never committed):

```text
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
```

Push the schema to your database, then run:

```bash
bunx drizzle-kit push --dialect postgresql --schema ./src/db/schema.ts --url "$DATABASE_URL"
bun run dev
```

## Scripts

- `bun run dev` / `bun run build` / `bun run start`
- `bun run lint` / `bun run typecheck`
- `PREVIEW_URL=http://localhost:3000 node scripts/smoke-test.mjs` — full browser suite (search, saves, collections, mobile, covers)

## Deploy (Vercel)

Framework preset: Next.js. Set `DATABASE_URL` in the Vercel project environment variables — no `vercel.json` needed.

## Notes

- The previous Vite frontend is preserved on `archive/pre-next-20250930` (and the original `legacy` branch).
- Cover art in `public/images/covers/` is placeholder art, not original box scans.
