/**
 * Optional real box art for the hero cartridges only.
 *
 * The cartridge-studio project resolves covers through ScreenScraper. That
 * flow needs dev credentials and a server-side proxy (keys must never ship
 * in the bundle, and browsers cannot call the API directly from every
 * network). This static site has neither, so the rule is strict:
 *
 * - Without the user's own `VITE_SCREENSCRAPER_*` keys, this module performs
 *   zero network requests and every hero cartridge wears a generated label.
 * - With keys, it resolves covers for the hero list only, one request at a
 *   time with breathing room between calls, and persists results in
 *   localStorage so a title is never looked up twice.
 *
 * Copy `.env.example` to `.env.local` (gitignored, never committed) and fill
 * in your own ScreenScraper dev credentials to enable it.
 */

const API = "https://www.screenscraper.fr/api2";
const CACHE_KEY = "roms.tn/cover-art/v1";
const LABEL_REGIONS = ["eu", "us", "wor", "ss", "jp"];

interface CacheEntry {
	url: string | null;
	at: number;
}

function readCache(): Record<string, CacheEntry> {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

function writeCache(cache: Record<string, CacheEntry>): void {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
	} catch {
		// Quota failures must never break the hero.
	}
}

interface Creds {
	id: string;
	password: string;
	soft: string;
}

function creds(): Creds | null {
	const id = import.meta.env.VITE_SCREENSCRAPER_DEV_ID?.trim();
	const password = import.meta.env.VITE_SCREENSCRAPER_DEV_PASSWORD?.trim();
	const soft = import.meta.env.VITE_SCREENSCRAPER_SOFT_NAME?.trim() || "roms-tn";
	if (!id || !password) return null;
	return { id, password, soft };
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

async function ssRequest(endpoint: string, params: Record<string, string>, c: Creds): Promise<unknown> {
	const qs = new URLSearchParams({
		output: "json",
		devid: c.id,
		devpassword: c.password,
		softname: c.soft,
		...params,
	});
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), 12000);
	try {
		const res = await fetch(`${API}/${endpoint}?${qs}`, { signal: controller.signal });
		const text = await res.text();
		if (!res.ok) throw new Error(`ScreenScraper ${res.status}`);
		return JSON.parse(text) as unknown;
	} finally {
		window.clearTimeout(timer);
	}
}

function pickLabelUrl(medias: unknown): string | null {
	const textures = asArray(medias as Array<{ type?: string; region?: string; url?: string }>).filter(
		(m) => m?.type === "support-texture" && typeof m.url === "string",
	);
	for (const region of LABEL_REGIONS) {
		const hit = textures.find((m) => m.region === region);
		if (hit?.url) return hit.url;
	}
	return textures[0]?.url ?? null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function resolveOne(title: string, c: Creds): Promise<string | null> {
	try {
		const data = (await ssRequest("jeuRecherche.php", { recherche: title }, c)) as {
			response?: { jeux?: unknown };
		};
		const jeux = asArray(data?.response?.jeux as Array<{ id?: number | string }>);
		const first = jeux.find((j) => j?.id != null);
		if (!first) return null;
		await sleep(400);
		const info = (await ssRequest("jeuInfos.php", { gameid: String(first.id) }, c)) as {
			response?: { jeu?: { medias?: unknown } };
		};
		return pickLabelUrl(info?.response?.jeu?.medias);
	} catch {
		return null;
	}
}

/**
 * Resolve box art for a small set of hero titles. Returns a map of title key
 * to label URL (or null when unresolvable). Never throws, never spams: one
 * title at a time, cached forever, skipped entirely without keys.
 */
export async function resolveHeroArt(
	titles: readonly string[],
	onEach?: (done: number, total: number) => void,
): Promise<Map<string, string | null>> {
	const out = new Map<string, string | null>();
	const keys = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
	for (const key of keys) out.set(key, null);
	if (keys.length === 0) return out;

	const cache = readCache();
	const missing = keys.filter((key) => !(key in cache));
	const c = creds();

	if (!c || missing.length === 0) {
		for (const key of keys) out.set(key, cache[key]?.url ?? null);
		onEach?.(keys.length, keys.length);
		return out;
	}

	let done = keys.length - missing.length;
	onEach?.(done, keys.length);
	for (const key of missing) {
		const url = await resolveOne(key, c);
		cache[key] = { url, at: Date.now() };
		writeCache(cache);
		out.set(key, url);
		done += 1;
		onEach?.(done, keys.length);
		await sleep(500);
	}
	for (const key of keys) {
		if (!out.has(key) || out.get(key) === undefined) out.set(key, cache[key]?.url ?? null);
	}
	return out;
}
