/**
 * Curated canon shelves.
 *
 * The arena build shipped these as fixed rows in a seeded Postgres table. We
 * have no database and no committed ROM list, so a template here is nothing
 * but a set of *search intents*. `resolveCanon` walks the live shared index
 * once and binds each intent to the best real record it can find, which means a
 * canon stays correct even when the host renames or re-files a dump.
 */

import type { RomEntry } from "./roms";
import type { ListPreset } from "./library-store";

export interface CanonIntent {
	/** Free text matched against the real record title. */
	query: string;
	/** Optional narrowing, matched against the real console name. */
	system?: string;
	/** Why this record earns its place on the shelf. */
	curatorNote: string;
}

export interface CanonTemplate {
	key: string;
	code: string;
	name: string;
	curator: string;
	preset: ListPreset;
	note: string;
	intents: CanonIntent[];
}

export interface ResolvedCanonItem {
	rom: RomEntry;
	curatorNote: string;
}

export const CANON_TEMPLATES: readonly CanonTemplate[] = [
	{
		key: "16bit-apex",
		code: "EXH-01",
		name: "The 16-bit apex",
		curator: "roms.tn Editorial",
		preset: "chromatic",
		note: "Five cartridges pressed at the moment 2D craft peaked, right before polygons reset the vocabulary.",
		intents: [
			{ query: "Chrono Trigger", system: "snes", curatorNote: "Zero random encounters, dual techs, and thirteen endings in 32 megabits." },
			{ query: "Super Metroid", system: "snes", curatorNote: "Wordless environmental storytelling that trusts the player to get lost." },
			{ query: "Final Fantasy VI", system: "snes", curatorNote: "Ensemble tragedy scored at the absolute limit of the SPC700 sound chip." },
			{ query: "EarthBound", system: "snes", curatorNote: "Americana filtered through a rolling HP odometer." },
			{ query: "Donkey Kong Country 2", system: "snes", curatorNote: "David Wise ambient synthesis paired with Rare's sharpest platforming." },
		],
	},
	{
		key: "isolation",
		code: "EXH-02",
		name: "Architecture of isolation",
		curator: "Zebes Research Group",
		preset: "silver",
		note: "From 8-bit graph paper to inverted castles: the evolution of the interconnected labyrinth.",
		intents: [
			{ query: "Metroid", system: "nes", curatorNote: "The origin point: vertical shafts, hostile silence, no hand-holding." },
			{ query: "Metroid II", curatorNote: "Monochrome claustrophobia with an extermination counter as the only compass." },
			{ query: "Super Metroid", system: "snes", curatorNote: "The sequence-breaker's bible." },
			{ query: "Castlevania: Symphony of the Night", system: "ps1", curatorNote: "Igarashi folds RPG stats into Zebes lock-and-key topology." },
			{ query: "Castlevania: Aria of Sorrow", system: "gba", curatorNote: "Pocket-sized perfection built on the Tactical Soul system." },
		],
	},
	{
		key: "coin-op",
		code: "EXH-03",
		name: "60fps coin-op discipline",
		curator: "Mikado Archive",
		preset: "gold",
		note: "Frame-tight input, 240p scanlines, and scoring built for one-credit survival.",
		intents: [
			{ query: "Street Fighter III", system: "arcade", curatorNote: "CPS-3 animation density and the ten-frame parry window." },
			{ query: "DoDonPachi", system: "arcade", curatorNote: "Cave's bullet-curtain manifesto." },
			{ query: "Ikaruga", system: "dreamcast", curatorNote: "Polarity puzzles at sixty frames per second." },
			{ query: "Gunstar Heroes", system: "genesis", curatorNote: "Motorola 68000 pushed to sprite-scaling madness." },
			{ query: "Metal Slug 3", system: "arcade", curatorNote: "Hand-pixelled maximalism on Neo Geo hardware." },
		],
	},
];

function normalize(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

const SYSTEM_HINTS: Record<string, string[]> = {
	nes: ["nes", "famicom"],
	snes: ["snes", "super famicom"],
	genesis: ["genesis", "mega drive"],
	gb: ["game boy"],
	gba: ["game boy advance"],
	n64: ["nintendo 64", "n64"],
	ps1: ["playstation"],
	dreamcast: ["dreamcast"],
	arcade: ["arcade", "mame", "fbneo", "neogeo"],
};

function systemMatches(console_: string, company: string, system: string): boolean {
	const aliases = SYSTEM_HINTS[system] ?? [system];
	return aliases.some((alias) => console_.includes(alias) || company.includes(alias));
}

/**
 * Bind every intent to the strongest real record in a single pass over the
 * index. A title match always beats a metadata match, and an exact title match
 * beats a prefix, so a canon prefers the canonical dump over a demo or a proto
 * with the same name.
 */
export function resolveCanon(roms: readonly RomEntry[], template: CanonTemplate): ResolvedCanonItem[] {
	const queries = template.intents.map((intent) => ({
		intent,
		needle: normalize(intent.query),
		score: -1,
		rom: null as RomEntry | null,
	}));

	for (const rom of roms) {
		const title = normalize(rom.title);
		if (!title) continue;
		const company = normalize(rom.company);
		const console_ = normalize(rom.console);
		for (const slot of queries) {
			if (slot.score >= 1000) continue;
			// These fields were normalized once above. Reusing them avoids
			// repeating that work for every hero/canon intent in the large index.
			if (slot.intent.system && !systemMatches(console_, company, slot.intent.system)) continue;
			let score = -1;
			if (title === slot.needle) score = 1000;
			else if (title.startsWith(slot.needle)) score = 760 - Math.min(200, title.length - slot.needle.length);
			else if (title.includes(slot.needle)) score = 520 - Math.min(200, title.length - slot.needle.length);
			else if (console_.includes(slot.needle)) score = 200;
			else if (company.includes(slot.needle)) score = 120;
			if (score > slot.score) {
				slot.score = score;
				slot.rom = rom;
			}
		}
	}

	const resolved: ResolvedCanonItem[] = [];
	const seen = new Set<string>();
	for (const slot of queries) {
		if (!slot.rom || seen.has(slot.rom.id)) continue;
		seen.add(slot.rom.id);
		resolved.push({ rom: slot.rom, curatorNote: slot.intent.curatorNote });
	}
	return resolved;
}
