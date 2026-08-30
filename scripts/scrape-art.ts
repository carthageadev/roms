/**
 * One-time dev script: scrapes cartridge labels and box covers from
 * ScreenScraper and saves them into src/assets/art so the landing page
 * can serve fully bundled assets without hitting the API at runtime.
 *
 * Usage: bun scripts/scrape-art.ts
 * Requires VITE_SCREENSCRAPER_DEV_ID / DEV_PASSWORD in .env (gitignored).
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DEV_ID = process.env.VITE_SCREENSCRAPER_DEV_ID;
const DEV_PASSWORD = process.env.VITE_SCREENSCRAPER_DEV_PASSWORD;
const SOFT_NAME = process.env.VITE_SCREENSCRAPER_SOFT_NAME ?? "roms.tn";

if (!DEV_ID || !DEV_PASSWORD) {
	console.error("Missing VITE_SCREENSCRAPER_DEV_ID / DEV_PASSWORD in .env");
	process.exit(1);
}

const REGION_ORDER = ["wor", "us", "eu", "ss", "jp"];
const OUT_ROOT = "src/assets/art";
const MIN_REQUEST_GAP_MS = 300;
let nextRequestAt = 0;

const N64_GAMES = [
	"Pokemon Stadium",
	"Pokemon Snap",
	"Mario Party",
	"Castlevania",
	"Bomberman 64",
	"Super Mario 64",
	"Mario Kart 64",
	"Ocarina of Time",
	"Star Fox 64",
	"GoldenEye 007",
	"Banjo-Kazooie",
	"Donkey Kong 64",
];

// Featured section covers: title, search term, ScreenScraper system id
const COVERS: Array<[string, string, number]> = [
	["Ocarina of Time", "Ocarina of Time", 14],
	["Metroid Prime", "Metroid Prime", 16],
	["Metal Gear Solid 2", "Metal Gear Solid 2 Sons of Liberty", 12],
	["Shenmue", "Shenmue", 23],
];

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
	const delay = Math.max(0, nextRequestAt - performance.now());
	if (delay) await wait(delay);
	nextRequestAt = performance.now() + MIN_REQUEST_GAP_MS;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
	for (let attempt = 0; ; attempt++) {
		await throttle();
		const res = await fetch(url);
		if (![429, 500, 502, 503, 504].includes(res.status) || attempt >= retries)
			return res;
		const retryAfter = Number(res.headers.get("retry-after"));
		const backoff =
			Number.isFinite(retryAfter) && retryAfter > 0
				? retryAfter * 1000
				: 500 * 2 ** attempt + Math.random() * 200;
		await wait(backoff);
	}
}

function apiParams(extra: Record<string, string>) {
	return new URLSearchParams({
		devid: DEV_ID,
		devpassword: DEV_PASSWORD,
		softname: SOFT_NAME,
		output: "json",
		...extra,
	});
}

async function getJson(url: string) {
	const res = await fetchWithRetry(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return JSON.parse(await res.text());
}

function pickMedia(
	medias: Array<{ type: string; region?: string; url?: string }>,
	type: string,
) {
	const candidates = medias.filter((m) => m.type === type && m.url);
	for (const region of REGION_ORDER) {
		const pick = candidates.find((m) => m.region === region);
		if (pick) return pick;
	}
	return candidates[0];
}

async function downloadMedia(
	media: { url: string },
	dest: string,
): Promise<boolean> {
	if (existsSync(dest)) {
		console.log(`skip  ${dest} (exists)`);
		return true;
	}
	// Media URLs need credentials appended when the API omits them
	const u = new URL(media.url);
	if (!u.searchParams.has("devid")) {
		u.searchParams.set("devid", DEV_ID);
		u.searchParams.set("devpassword", DEV_PASSWORD);
		u.searchParams.set("softname", SOFT_NAME);
	}
	const res = await fetchWithRetry(u.toString());
	const type = res.headers.get("content-type") ?? "";
	if (!res.ok || !type.startsWith("image")) {
		console.error(`fail  ${dest} (${res.status} ${type})`);
		return false;
	}
	await Bun.write(dest, await res.arrayBuffer());
	console.log(`saved ${dest}`);
	return true;
}

async function scrapeGameId(
	search: string,
	systemId: number,
): Promise<string | null> {
	const data = await getJson(
		`https://www.screenscraper.fr/api2/jeuRecherche.php?${apiParams({
			systemeid: String(systemId),
			recherche: search,
		})}`,
	);
	const raw = data?.response?.jeux;
	const list = Array.isArray(raw) ? raw : raw?.jeu ? [].concat(raw.jeu) : [];
	return list[0]?.id ?? null;
}

async function scrapeMedias(gameId: string) {
	const data = await getJson(
		`https://www.screenscraper.fr/api2/jeuInfos.php?${apiParams({ gameid: gameId })}`,
	);
	return data?.response?.jeu?.medias ?? [];
}

async function main() {
	mkdirSync(join(OUT_ROOT, "n64"), { recursive: true });
	mkdirSync(join(OUT_ROOT, "covers"), { recursive: true });

	let ok = 0;
	let fail = 0;

	console.log(`Scraping ${N64_GAMES.length} N64 cartridge labels...`);
	for (const title of N64_GAMES) {
		try {
			const id = await scrapeGameId(title, 14);
			if (!id) throw new Error("no match");
			const medias = await scrapeMedias(id);
			const media = pickMedia(medias, "support-texture");
			if (!media) throw new Error("no support-texture media");
			const dest = join(OUT_ROOT, "n64", `${slug(title)}.png`);
			(await downloadMedia(media, dest)) ? ok++ : fail++;
		} catch (e) {
			console.error(
				`fail  n64/${slug(title)} (${e instanceof Error ? e.message : e})`,
			);
			fail++;
		}
	}

	console.log(`Scraping ${COVERS.length} featured covers...`);
	for (const [title, search, systemId] of COVERS) {
		try {
			const id = await scrapeGameId(search, systemId);
			if (!id) throw new Error("no match");
			const medias = await scrapeMedias(id);
			const media =
				pickMedia(medias, "box-2D") ?? pickMedia(medias, "support-texture");
			if (!media) throw new Error("no media");
			const dest = join(OUT_ROOT, "covers", `${slug(title)}.png`);
			(await downloadMedia(media, dest)) ? ok++ : fail++;
		} catch (e) {
			console.error(
				`fail  covers/${slug(title)} (${e instanceof Error ? e.message : e})`,
			);
			fail++;
		}
	}

	console.log(`\nDone. ${ok} saved, ${fail} failed.`);
}

main();
