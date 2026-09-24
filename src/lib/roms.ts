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
	totalFiles: number;
	companies: string[];
	consoles: string[];
	byConsoleCounts?: Record<string, number>;
}

const REMOTE_DATA_URL = "https://carthageadev.github.io/atlas/data";
const LOCAL_DATA_URL = "/data";

let inFlight: Promise<RomIndex> | null = null;

export interface RomIndex {
	meta: AtlasMeta | null;
	roms: RomEntry[];
}

function dataBases(): string[] {
	const configured = import.meta.env.VITE_ATLAS_DATA_URL?.trim().replace(/\/$/, "");
	if (configured) return [configured];
	return [REMOTE_DATA_URL, LOCAL_DATA_URL];
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
	const response = await fetch(url, { signal, cache: "no-store" });
	if (!response.ok) throw new Error(`${url} returned ${response.status}`);
	return (await response.json()) as T;
}

async function fetchMeta(base: string, signal?: AbortSignal): Promise<AtlasMeta | null> {
	try {
		return await fetchJson<AtlasMeta>(`${base}/meta.json`, signal);
	} catch {
		return null;
	}
}

async function fetchRoms(base: string, onProgress: (message: string) => void, signal?: AbortSignal): Promise<RomEntry[]> {
	onProgress("fetching roms.json.gz");
	const response = await fetch(`${base}/roms.json.gz`, { signal });
	if (!response.ok) throw new Error(`${base}/roms.json.gz returned ${response.status}`);
	onProgress("decompressing index");
	const stream = response.body?.pipeThrough(new DecompressionStream("gzip"));
	if (!stream) throw new Error("This browser cannot decompress the Atlas index");
	const roms = (await new Response(stream).json()) as RomEntry[];
	if (!Array.isArray(roms) || roms.length === 0) throw new Error("Atlas index is empty");
	return roms;
}

export function loadRomIndex(onProgress: (message: string) => void = () => {}): Promise<RomIndex> {
	if (inFlight) return inFlight;
	inFlight = (async () => {
		const errors: string[] = [];
		for (const base of dataBases()) {
			try {
				const meta = await fetchMeta(base);
				if (meta?.totalFiles === 0) {
					errors.push(`${base}: published an empty index`);
					continue;
				}
				const roms = await fetchRoms(base, onProgress);
				return { meta, roms };
			} catch (error) {
				errors.push(`${base}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		throw new Error(`Unable to load the shared Atlas index. ${errors.join(" ")}`);
	})().catch((error) => {
		inFlight = null;
		throw error;
	});
	return inFlight;
}

export interface ParsedQuery {
	text: string;
	terms: string[];
	tokens: { raw: string; kind: "filter" | "text" | "bad" }[];
	platforms: string[];
	companies: string[];
	year?: { min: number; max: number; raw: string };
}

export interface RomHit {
	rom: RomEntry;
	score: number;
	hl: boolean[];
	metaHits: Set<"company" | "console" | "year">;
}

export interface RomSearchResult {
	hits: RomHit[];
	parsed: ParsedQuery;
	ms: number;
}

const FILTER_KEYS: Record<string, "platform" | "company" | "year"> = {
	p: "platform",
	platform: "platform",
	sys: "platform",
	system: "platform",
	c: "company",
	company: "company",
	maker: "company",
	y: "year",
	year: "year",
};

function normalize(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

function parseYear(value: string): ParsedQuery["year"] | null {
	let match = value.match(/^(\d{4})$/);
	if (match) return { min: Number(match[1]), max: Number(match[1]), raw: value };
	match = value.match(/^(\d{3})x$/i);
	if (match) {
		const start = Number(match[1]) * 10;
		return { min: start, max: start + 9, raw: value };
	}
	match = value.match(/^(\d{4})(?:-|\.\.)(\d{4})$/);
	if (match) return { min: Number(match[1]), max: Number(match[2]), raw: value };
	match = value.match(/^>=?(\d{4})$/);
	if (match) return { min: Number(match[1]), max: 9999, raw: value };
	match = value.match(/^<=?(\d{4})$/);
	if (match) return { min: 0, max: Number(match[1]), raw: value };
	return null;
}

export function parseQuery(query: string): ParsedQuery {
	const platforms: string[] = [];
	const companies: string[] = [];
	const tokens: ParsedQuery["tokens"] = [];
	const textParts: string[] = [];
	let year: ParsedQuery["year"];
	const tokenPattern = /(\S+?):("[^"]*"?|\S*)|"([^"]*)"?|(\S+)/g;
	let match: RegExpExecArray | null;

	while ((match = tokenPattern.exec(query))) {
		const raw = match[0];
		if (match[1] !== undefined) {
			const key = FILTER_KEYS[match[1].toLowerCase()];
			const value = (match[2] ?? "").replace(/"/g, "").trim();
			if (!key || !value) {
				tokens.push({ raw, kind: "bad" });
				textParts.push(raw);
				continue;
			}
			if (key === "platform") {
				platforms.push(...value.split(",").map((item) => normalize(item)).filter(Boolean));
				tokens.push({ raw, kind: "filter" });
			} else if (key === "company") {
				companies.push(...value.split(",").map((item) => normalize(item)).filter(Boolean));
				tokens.push({ raw, kind: "filter" });
			} else {
				const parsedYear = parseYear(value);
				if (!parsedYear) {
					tokens.push({ raw, kind: "bad" });
					textParts.push(raw);
					continue;
				}
				year = parsedYear;
				tokens.push({ raw, kind: "filter" });
			}
		} else {
			textParts.push(match[3] ?? match[4] ?? "");
			tokens.push({ raw, kind: "text" });
		}
	}

	const text = normalize(textParts.join(" ")).replace(/[^a-z0-9$&\s]/g, " ").replace(/\s+/g, " ").trim();
	return {
		text,
		terms: text ? text.split(" ").filter((term) => term !== "&") : [],
		tokens,
		platforms,
		companies,
		year,
	};
}

function dateYear(rom: RomEntry): number | null {
	const match = rom.date?.match(/(19|20)\d{2}/);
	return match ? Number(match[0]) : null;
}

function matchesPlatform(rom: RomEntry, platform: string): boolean {
	const consoleName = normalize(rom.console);
	const company = normalize(rom.company);
	return consoleName === platform || consoleName.includes(platform) || company === platform;
}

function markTitle(title: string, term: string, highlight: boolean[]): void {
	const lowerTitle = title.toLowerCase();
	const lowerTerm = term.toLowerCase();
	let offset = 0;
	while (offset < title.length) {
		const found = lowerTitle.indexOf(lowerTerm, offset);
		if (found < 0) break;
		for (let i = found; i < found + term.length && i < highlight.length; i++) highlight[i] = true;
		offset = found + Math.max(1, term.length);
	}
}

function scoreRom(rom: RomEntry, parsed: ParsedQuery, metaHits: RomHit["metaHits"]): number {
	let score = 0;
	const title = normalize(rom.title);
	const searchText = rom.searchText || `${title} ${normalize(rom.company)} ${normalize(rom.console)} ${normalize(rom.folder)}`;

	for (const term of parsed.terms) {
		if (!searchText.includes(term)) return -1;
		if (title === term) score += 1000;
		else if (title.startsWith(term)) score += 500;
		else if (title.includes(term)) score += 250;
		else if (normalize(rom.console).includes(term)) {
			score += 80;
			metaHits.add("console");
		} else if (normalize(rom.company).includes(term)) {
			score += 65;
			metaHits.add("company");
		} else {
			score += 20;
		}
	}

	if (parsed.platforms.some((platform) => !matchesPlatform(rom, platform))) return -1;
	if (parsed.platforms.length) score += 100;

	for (const company of parsed.companies) {
		if (!normalize(rom.company).includes(company)) return -1;
		score += 90;
		metaHits.add("company");
	}

	if (parsed.year) {
		const year = dateYear(rom);
		if (year === null || year < parsed.year.min || year > parsed.year.max) return -1;
		score += 60;
		metaHits.add("year");
	}

	if (!parsed.terms.length) score += Math.max(0, 100 - rom.title.length / 4);
	return score;
}

export function searchRoms(roms: RomEntry[], query: string): RomSearchResult {
	const started = performance.now();
	const parsed = parseQuery(query);
	const hits: RomHit[] = [];
	for (const rom of roms) {
		const metaHits: RomHit["metaHits"] = new Set();
		const score = scoreRom(rom, parsed, metaHits);
		if (score < 0) continue;
		const hl = new Array<boolean>(rom.title.length).fill(false);
		for (const term of parsed.terms) markTitle(rom.title, term, hl);
		hits.push({ rom, score, hl, metaHits });
	}
	hits.sort((a, b) => b.score - a.score || a.rom.title.localeCompare(b.rom.title));
	return { hits, parsed, ms: performance.now() - started };
}
