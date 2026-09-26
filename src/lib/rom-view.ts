/**
 * View-model layer.
 *
 * The real index gives us flat `RomEntry` records. The premium design language
 * wants a game-shaped object (platform, year, size, hue, initials). Everything
 * derived lives here so the cards stay dumb and the data source stays intact.
 */

import type { RomEntry } from "./roms";

export interface RomView {
	/** Stable key: the real record id from the shared index. */
	id: string;
	slug: string;
	title: string;
	/** System / console name. */
	platform: string;
	/** Publisher or developer, as recorded in the index. */
	publisher: string;
	year: number | null;
	date: string;
	/** Size in megabytes when the index reports it, else null. */
	sizeMb: number | null;
	/** Human size string straight from the index when available. */
	size: string;
	folder: string;
	/** Remote source URL used by the explicit Download action. */
	url: string;
	/** Stable hue so a given rom always gets the same generated cover. */
	hue: number;
	initials: string;
}

export function hashHue(seed: string): number {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return Math.abs(h) % 360;
}

export function slugify(value: string): string {
	return (
		value
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || "rom"
	);
}

export function titleInitials(title: string): string {
	return (
		title
			.replace(/[^A-Za-z0-9 ]/g, "")
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0])
			.join("")
			.toUpperCase() || "?"
	);
}

export function romYear(rom: RomEntry): number | null {
	const match = rom.date?.match(/(19|20)\d{2}/);
	return match ? Number(match[0]) : null;
}

const MB = 1024 * 1024;

export function romSizeMb(rom: RomEntry): number | null {
	if (typeof rom.sizeBytes === "number" && rom.sizeBytes > 0) return rom.sizeBytes / MB;
	const bytes = Number.parseInt(rom.size ?? "", 10);
	return Number.isFinite(bytes) && bytes > 0 ? bytes / MB : null;
}

export function formatSizeMb(sizeMb: number | null): string {
	if (sizeMb === null) return "—";
	if (sizeMb >= 1024) return `${(sizeMb / 1024).toFixed(1)} GB`;
	return `${sizeMb >= 10 ? sizeMb.toFixed(1) : sizeMb.toFixed(2)} MB`;
}

export function formatCount(value: number): string {
	if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
	return String(value);
}

export function toRomView(rom: RomEntry): RomView {
	return {
		id: rom.id,
		slug: slugify(rom.title || rom.id),
		title: rom.title,
		platform: rom.console || "Unknown system",
		publisher: rom.company || "Uncredited",
		year: romYear(rom),
		date: rom.date ?? "",
		sizeMb: romSizeMb(rom),
		size: rom.size ?? "",
		folder: rom.folder,
		url: rom.url,
		hue: hashHue(rom.id || rom.title),
		initials: titleInitials(rom.title || rom.id),
	};
}

const viewCache = new WeakMap<RomEntry, RomView>();

/** Memoised per record — the same `RomEntry` object always maps to one view. */
export function romView(rom: RomEntry): RomView {
	const cached = viewCache.get(rom);
	if (cached) return cached;
	const view = toRomView(rom);
	viewCache.set(rom, view);
	return view;
}

export interface RomIndexView {
	byId: Map<string, RomEntry>;
	bySlug: Map<string, RomEntry>;
	views: RomView[];
	roms: RomEntry[];
}

/** Build id + slug lookup tables once the real index is loaded. */
export function buildRomIndexView(roms: RomEntry[]): RomIndexView {
	const byId = new Map<string, RomEntry>();
	const bySlug = new Map<string, RomEntry>();
	const views: RomView[] = [];
	for (const rom of roms) {
		byId.set(rom.id, rom);
		const view = romView(rom);
		views.push(view);
		if (!bySlug.has(view.slug)) bySlug.set(view.slug, rom);
	}
	return { byId, bySlug, views, roms };
}

/** Resolve `/rom/:slugOrId` — ids win, slugs are the pretty form. */
export function findRom(index: RomIndexView, param: string): RomEntry | undefined {
	return index.byId.get(param) ?? index.bySlug.get(param.toLowerCase());
}

/**
 * Derive a stable, non-trivial "featured" shelf from whatever is loaded.
 * The first pass is the source order; after that we keep a shortlist from
 * several well-known publishers so the shelf is not one long alphabetical run.
 */
export function featuredRoms(roms: RomEntry[], limit: number): RomEntry[] {
	if (roms.length <= limit) return roms.slice(0, limit);
	const anchors = [
		"nintendo",
		"sega",
		"sony",
		"capcom",
		"konami",
		"square",
		"namco",
		"koei",
		"atlus",
		"nintendo",
	];
	const picked: RomEntry[] = [];
	const seen = new Set<string>();
	for (const anchor of anchors) {
		const match = roms.find((rom) => !seen.has(rom.id) && rom.company?.toLowerCase().includes(anchor));
		if (match) {
			seen.add(match.id);
			picked.push(match);
		}
		if (picked.length >= limit) break;
	}
	for (const rom of roms) {
		if (picked.length >= limit) break;
		if (seen.has(rom.id)) continue;
		seen.add(rom.id);
		picked.push(rom);
	}
	return picked;
}

export interface ConsoleStat {
	name: string;
	count: number;
}

export function consoleStats(roms: RomEntry[]): ConsoleStat[] {
	const counts = new Map<string, number>();
	for (const rom of roms) {
		const name = rom.console || "Unknown";
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function topCompanies(roms: RomEntry[], limit: number): ConsoleStat[] {
	const counts = new Map<string, number>();
	for (const rom of roms) {
		const name = rom.company || "Uncredited";
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		.slice(0, limit);
}

/** Filter real records by console / company without touching the loader. */
export function filterByConsole(roms: RomEntry[], console: string): RomEntry[] {
	if (console === "all") return roms;
	return roms.filter((rom) => rom.console === console);
}

export function filterByCompany(roms: RomEntry[], company: string): RomEntry[] {
	if (company === "all") return roms;
	return roms.filter((rom) => rom.company === company);
}
