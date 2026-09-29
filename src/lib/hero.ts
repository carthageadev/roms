/**
 * Hero cartridges.
 *
 * The most recognizable records in the catalogue, one per intent. Like the
 * canon shelves, an intent is a *search* against the live shared index, not a
 * hardcoded record, so the hero survives host renames and re-files. The list
 * leans on the big platforms (N64, GBA, PSX, SNES) instead of whatever the
 * source order happens to surface first.
 */

import { resolveCanon, type CanonIntent, type ResolvedCanonItem } from "./canon";
import type { RomEntry } from "./roms";

const HERO_INTENTS: readonly CanonIntent[] = [
	{ query: "Super Mario 64", system: "n64", curatorNote: "" },
	{ query: "Ocarina of Time", system: "n64", curatorNote: "" },
	{ query: "GoldenEye 007", system: "n64", curatorNote: "" },
	{ query: "Mario Kart 64", system: "n64", curatorNote: "" },
	{ query: "Pokemon Emerald", system: "gba", curatorNote: "" },
	{ query: "Minish Cap", system: "gba", curatorNote: "" },
	{ query: "Metroid Fusion", system: "gba", curatorNote: "" },
	{ query: "Final Fantasy VII", system: "ps1", curatorNote: "" },
	{ query: "Metal Gear Solid", system: "ps1", curatorNote: "" },
	{ query: "Symphony of the Night", system: "ps1", curatorNote: "" },
	{ query: "Chrono Trigger", system: "snes", curatorNote: "" },
	{ query: "Super Metroid", system: "snes", curatorNote: "" },
];

const HERO_TEMPLATE = {
	key: "hero",
	code: "HERO",
	name: "Hero",
	curator: "roms.tn",
	preset: "gold" as const,
	note: "",
	intents: [...HERO_INTENTS],
};

/** Bind every hero intent to the strongest real record, in list order. */
export function resolveHero(roms: readonly RomEntry[]): ResolvedCanonItem[] {
	return resolveCanon(roms, HERO_TEMPLATE);
}
