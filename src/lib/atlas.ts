// Single source of truth for ROM data:
//   D:\Github\atlas\scraper\scraper.py  (weekly cron -> data/roms.json.gz + data/meta.json)
// roms-tn does NOT scrape. It only consumes the built Atlas artifacts,
// either from the local copy in public/data/ or from the deployed Atlas site.

export interface RomEntry {
	id: string;
	title: string;
	href: string;
	url: string;
	company: string;
	console: string;
	folder: string;
	folderParts?: string[];
	size?: string;
	sizeBytes?: number;
	date?: string;
	searchText: string;
}

export interface AtlasMeta {
	generatedAt: string;
	baseUrl: string;
	targets?: string[];
	totalFiles: number;
	contentHash?: string;
	companies: string[];
	consoles: string[];
	byConsoleCounts?: Record<string, number>;
}

export const ATLAS_REMOTE_BASE = "https://carthageadev.github.io/atlas/data";

/** Base URL for Atlas data. Override with VITE_ATLAS_DATA_URL. Defaults to local /data. */
export function resolveAtlasBase(): string {
	const env = (import.meta.env.VITE_ATLAS_DATA_URL as string | undefined)
		?.trim()
		.replace(/\/$/, "");
	if (env) return env;
	return "/data";
}

export async function fetchAtlasMeta(
	base: string,
): Promise<AtlasMeta | null> {
	try {
		const res = await fetch(`${base}/meta.json`, { cache: "no-store" });
		if (!res.ok) return null;
		return (await res.json()) as AtlasMeta;
	} catch {
		return null;
	}
}

/** Fetch + gunzip roms.json.gz (falls back to plain roms.json). */
export async function fetchAtlasDocs(
	base: string,
	onProgress?: (text: string) => void,
): Promise<RomEntry[]> {
	const errors: string[] = [];

	// 1) preferred: gzip artifact (what Atlas deploys)
	try {
		onProgress?.("Fetching roms.json.gz…");
		const res = await fetch(`${base}/roms.json.gz`);
		if (!res.ok) throw new Error(`gz http ${res.status}`);
		if (!res.body || typeof DecompressionStream === "undefined") {
			const buf = await res.arrayBuffer();
			const ds = new DecompressionStream("gzip");
			const stream = new Blob([buf])
				.stream()
				.pipeThrough(ds as unknown as TransformStream);
			onProgress?.("Decompressing gzip…");
			const text = await new Response(stream).text();
			return JSON.parse(text) as RomEntry[];
		}
		onProgress?.("Decompressing gzip…");
		const ds = new DecompressionStream("gzip");
		const text = await new Response(res.body.pipeThrough(ds)).text();
		return JSON.parse(text) as RomEntry[];
	} catch (e) {
		errors.push(`gz: ${String(e)}`);
	}

	// 2) fallback: plain json (local dev if someone gunzipped it)
	try {
		onProgress?.("Fetching roms.json…");
		const res = await fetch(`${base}/roms.json`);
		if (!res.ok) throw new Error(`json http ${res.status}`);
		return (await res.json()) as RomEntry[];
	} catch (e) {
		errors.push(`json: ${String(e)}`);
	}

	throw new Error(`Could not load Atlas index from ${base} (${errors.join("; ")})`);
}

/**
 * Load Atlas index: try local base first, fall back to remote Pages deploy.
 * Returns which base actually worked so the UI can show it.
 */
export async function loadAtlasIndex(
	onProgress?: (text: string) => void,
): Promise<{ meta: AtlasMeta | null; docs: RomEntry[]; base: string }> {
	const primary = resolveAtlasBase();
	const candidates =
		primary === ATLAS_REMOTE_BASE
			? [primary]
			: [primary, ATLAS_REMOTE_BASE];

	let lastError: unknown = null;
	for (const base of candidates) {
		try {
			const meta = await fetchAtlasMeta(base);
			if (meta && meta.totalFiles === 0) {
				// Upstream published an empty index - try next source.
				continue;
			}
			const docs = await fetchAtlasDocs(base, onProgress);
			if (docs.length === 0) continue;
			return { meta, docs, base };
		} catch (e) {
			lastError = e;
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error("Atlas index unavailable locally and remotely");
}

// ─── Search (mirrors atlas site/worker.js semantics, no MiniSearch dep) ─────

export type SortKey =
	| "relevance"
	| "title-asc"
	| "title-desc"
	| "console-asc"
	| "company-asc"
	| "size-desc"
	| "size-asc"
	| "date-desc";

export interface SearchParams {
	q: string;
	company: string;
	consoleVal: string;
	folderSub: string;
	sortBy: SortKey;
}

export function searchRoms(docs: RomEntry[], params: SearchParams): RomEntry[] {
	const { q, company, consoleVal, folderSub, sortBy } = params;
	const trimmed = q.trim().toLowerCase();
	const tokens = trimmed.split(/\s+/).filter(Boolean);

	let out: RomEntry[];
	if (tokens.length === 0) {
		out = docs.slice();
	} else {
		// AND over tokens against precomputed searchText (same as worker fast-mode).
		out = docs.filter((d) => {
			const hay = d.searchText;
			for (const t of tokens) {
				if (!hay.includes(t)) return false;
			}
			return true;
		});
	}

	if (company) out = out.filter((d) => d.company === company);
	if (consoleVal) out = out.filter((d) => d.console === consoleVal);
	if (folderSub) {
		const low = folderSub.toLowerCase();
		out = out.filter((d) => d.folder.toLowerCase().includes(low));
	}

	const byTitle = (a: RomEntry, b: RomEntry) => a.title.localeCompare(b.title);

	switch (sortBy) {
		case "title-asc":
			out.sort(byTitle);
			break;
		case "title-desc":
			out.sort((a, b) => b.title.localeCompare(a.title));
			break;
		case "console-asc":
			out.sort(
				(a, b) =>
					(a.console || "").localeCompare(b.console || "") || byTitle(a, b),
			);
			break;
		case "company-asc":
			out.sort(
				(a, b) =>
					a.company.localeCompare(b.company) ||
					(a.console || "").localeCompare(b.console || "") ||
					byTitle(a, b),
			);
			break;
		case "size-desc":
			out.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
			break;
		case "size-asc":
			out.sort((a, b) => (a.sizeBytes || 0) - (b.sizeBytes || 0));
			break;
		case "date-desc":
			out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
			break;
		case "relevance":
		default:
			if (trimmed) {
				// cheap relevance: earliest match position, then shorter title, then A-Z
				const first = tokens[0];
				out.sort((a, b) => {
					const pa = a.searchText.indexOf(first);
					const pb = b.searchText.indexOf(first);
					if (pa !== pb) return pa - pb;
					if (a.title.length !== b.title.length)
						return a.title.length - b.title.length;
					return byTitle(a, b);
				});
			} else {
				out.sort(byTitle);
			}
			break;
	}

	return out;
}

// ─── Product of the Week (deterministic weekly pick, changes Mondays) ───────

export function getWeekKey(now: Date = new Date()): {
	year: number;
	week: number;
} {
	const d = new Date(
		Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
	);
	const day = (d.getUTCDay() + 6) % 7; // Mon=0
	d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
	const year = d.getUTCFullYear();
	const firstThu = new Date(Date.UTC(year, 0, 4));
	const fday = (firstThu.getUTCDay() + 6) % 7;
	firstThu.setUTCDate(firstThu.getUTCDate() - fday + 3);
	const week = Math.round((d.getTime() - firstThu.getTime()) / 604800000) + 1;
	return { year, week };
}

/** Deterministic spotlight ROM for the current ISO week. Prefers marquee companies. */
export function getWeeklyFeatured(
	docs: RomEntry[],
	now: Date = new Date(),
): { rom: RomEntry; year: number; week: number } | null {
	if (docs.length === 0) return null;
	const { year, week } = getWeekKey(now);
	const MARQUEE_CONSOLES = new Set([
		"Nintendo 64",
		"GameCube",
		"Super Famicom (SNES)",
		"Famicom (NES)",
		"Game Boy",
		"Game Boy Advance",
		"Game Boy Color",
		"DS (Decrypted)",
		"Wii",
		"PlayStation",
		"PlayStation Portable",
		"Genesis",
		"Saturn",
		"DreamCast",
		"Game Gear",
		"Master System",
	]);
	const branded = docs.filter(
		(d) =>
			(d.company === "Nintendo" || d.company === "SEGA" || d.company === "SONY") &&
			MARQUEE_CONSOLES.has(d.console) &&
			(d.sizeBytes || 0) > 500_000 &&
			!/(demo|aftermarket|unl\)|bios)/i.test(d.title),
	);
	// Keep the weekly pick recognizable: prefer iconic franchises when possible.
	const ICONIC = [
		"mario",
		"zelda",
		"sonic",
		"pokemon",
		"metroid",
		"donkey kong",
		"final fantasy",
		"resident evil",
		"metal gear",
		"gran turismo",
		"tekken",
		"kirby",
		"star fox",
		"bomberman",
		"castlevania",
		"mega man",
		"street fighter",
		"crash bandicoot",
		"spyro",
	];
	const iconic = branded.filter((d) => {
		const t = d.title.toLowerCase();
		return ICONIC.some((k) => t.includes(k));
	});
	const fallbackPool = docs.filter(
		(d) => d.company === "Nintendo" || d.company === "SEGA" || d.company === "SONY",
	);
	const list =
		iconic.length > 50
			? iconic
			: branded.length > 500
				? branded
				: fallbackPool.length > 100
					? fallbackPool
					: docs;
	let h = (year * 53 + week) >>> 0;
	h = Math.imul(h ^ 0x9e3779b9, 2654435761) >>> 0;
	h ^= h >>> 15;
	h = Math.imul(h, 2246822519) >>> 0;
	const index = h % list.length;
	return { rom: list[index], year, week };
}
