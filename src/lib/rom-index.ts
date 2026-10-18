import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { Game } from "./types";

const REMOTE_DATA_URL = "https://carthageadev.github.io/atlas/data";

interface RomEntry {
	id: string;
	title: string;
	company: string;
	console: string;
	folder: string;
	date?: string;
	searchText: string;
}

interface RomIndexCache {
	roms: RomEntry[];
	loadedAt: number;
}

let cache: RomIndexCache | null = null;
let inFlight: Promise<RomEntry[]> | null = null;

function dataBase(): string {
	const configured = process.env.ATLAS_DATA_URL?.trim().replace(/\/$/, "");
	return configured || REMOTE_DATA_URL;
}

function normalize(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

async function loadRomEntries(): Promise<RomEntry[]> {
	if (cache) return cache.roms;
	if (!inFlight) {
		inFlight = (async () => {
			const base = dataBase();
			const metaRes = await fetch(`${base}/meta.json`, { cache: "no-store" });
			if (!metaRes.ok) throw new Error(`Index metadata returned ${metaRes.status}`);
			const romsRes = await fetch(`${base}/roms.json.gz`, { cache: "no-store" });
			if (!romsRes.ok) throw new Error(`Index archive returned ${romsRes.status}`);
			const gzipped = new Uint8Array(await romsRes.arrayBuffer());
			const parsed = JSON.parse(gunzipSync(gzipped).toString("utf-8")) as RomEntry[];
			if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("The published index is empty.");
			cache = { roms: parsed, loadedAt: Date.now() };
			return parsed;
		})().catch((error) => {
			inFlight = null;
			throw error;
		});
	}
	return inFlight;
}

function platformKey(consoleName: string): string {
	const name = normalize(consoleName);
	if (name.includes("nintendo 64") || name === "n64") return "n64";
	if (name.includes("super nintendo") || name.includes("super famicom") || name === "snes") return "snes";
	if (name.includes("game boy advance") || name === "gba") return "gba";
	if (name.includes("game boy color") || name === "gbc" || name === "gb" || name.startsWith("game boy")) return "gb";
	if (name.includes("playstation") && !name.includes("playstation 2") && !name.includes("ps2")) return "ps1";
	if (name.includes("genesis") || name.includes("mega drive")) return "genesis";
	return "rom";
}

function romYear(date: string | undefined): number | null {
	const match = date?.match(/(19|20)\d{2}/);
	return match ? Number(match[0]) : null;
}

function hueFor(id: string): number {
	const hash = createHash("sha1").update(id).digest();
	return Math.round((hash[0] / 255) * 360);
}

export function romGameId(atlasId: string): string {
	return `rom-${createHash("sha1").update(atlasId).digest("hex").slice(0, 12)}`;
}

export function romToGame(rom: RomEntry): Game {
	const hue = hueFor(rom.id);
	const company = rom.company?.trim() || "Unknown maker";
	const consoleName = rom.console?.trim() || "Unknown system";
	return {
		id: romGameId(rom.id),
		title: rom.title,
		platform: platformKey(rom.console),
		platformName: consoleName,
		year: romYear(rom.date),
		genre: "Archive",
		developer: company,
		description: `From the full ROM index — filed under ${company} on ${consoleName}. Save it to keep it close.`,
		cover: "/images/rom-blank.png",
		color: `hsl(${hue} 45% 88%)`,
		accent: `hsl(${hue} 30% 45%)`,
		rank: 100000,
		source: "rom",
	};
}

function scoreRom(rom: RomEntry, terms: string[], full: string): number {
	const title = normalize(rom.title);
	const searchText =
		rom.searchText || `${title} ${normalize(rom.company)} ${normalize(rom.console)} ${normalize(rom.folder)}`;
	let score = 0;
	for (const term of terms) {
		if (!searchText.includes(term)) return -1;
		if (title === term) score += 1000;
		else if (title.startsWith(term)) score += 500;
		else if (title.includes(term)) score += 250;
		else if (normalize(rom.console).includes(term)) score += 80;
		else if (normalize(rom.company).includes(term)) score += 65;
		else score += 20;
	}
	// Prefer the entry the query actually names over longer partial matches.
	if (full && title.startsWith(full)) score += 300;
	score += Math.max(0, 200 - title.length * 2);
	return score;
}

export async function searchRomIndex(query: string, limit = 12): Promise<{ games: Game[]; total: number }> {
	const full = normalize(query).replace(/\s+/g, " ").trim();
	const terms = full.split(" ").filter(Boolean);
	if (terms.length === 0) return { games: [], total: 0 };
	const roms = await loadRomEntries();
	const scored: Array<{ rom: RomEntry; score: number }> = [];
	for (const rom of roms) {
		const score = scoreRom(rom, terms, full);
		if (score >= 0) scored.push({ rom, score });
	}
	scored.sort((a, b) => b.score - a.score || a.rom.title.localeCompare(b.rom.title));
	const safeLimit = Math.max(1, Math.min(limit, 40));
	return { games: scored.slice(0, safeLimit).map((hit) => romToGame(hit.rom)), total: scored.length };
}
