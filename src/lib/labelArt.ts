/**
 * Cartridge label art resolution.
 *
 * Order of preference per game:
 *   1. IndexedDB blob cache      -> zero network
 *   2. ScreenScraper API         -> real cartridge label texture
 *      (only when VITE_SCREENSCRAPER_DEV_ID / DEV_PASSWORD are set,
 *      proxied through /api2 to avoid CORS)
 *   3. Canvas-generated label    -> always works, no credentials needed
 */

const REGION_ORDER = ["wor", "us", "eu", "ss", "jp"] as const;

const DEV_ID = import.meta.env.VITE_SCREENSCRAPER_DEV_ID as string | undefined;
const DEV_PASSWORD = import.meta.env.VITE_SCREENSCRAPER_DEV_PASSWORD as
	| string
	| undefined;
const SOFT_NAME =
	(import.meta.env.VITE_SCREENSCRAPER_SOFT_NAME as string) ?? "roms.tn";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MIN_REQUEST_GAP_MS = 250;
let nextRequestAt = 0;

const wait = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
			return;
		}
		const id = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(id);
				reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
			},
			{ once: true },
		);
	});

async function throttle(signal?: AbortSignal) {
	signal?.throwIfAborted();
	const delay = Math.max(0, nextRequestAt - performance.now());
	if (delay) await wait(delay, signal);
	nextRequestAt = performance.now() + MIN_REQUEST_GAP_MS;
}

async function fetchWithRetry(
	url: string,
	{ signal, retries = 3 }: { signal?: AbortSignal; retries?: number } = {},
): Promise<Response> {
	for (let attempt = 0; ; attempt++) {
		await throttle(signal);
		const res = await fetch(url, { signal });
		if (!RETRYABLE_STATUS.has(res.status) || attempt >= retries) return res;
		const retryAfter = Number(res.headers.get("retry-after"));
		const backoff =
			Number.isFinite(retryAfter) && retryAfter > 0
				? retryAfter * 1000
				: 500 * 2 ** attempt + Math.random() * 200;
		await wait(backoff, signal);
	}
}

function apiParams(extra: Record<string, string>) {
	return new URLSearchParams({
		devid: DEV_ID ?? "",
		devpassword: DEV_PASSWORD ?? "",
		softname: SOFT_NAME,
		output: "json",
		...extra,
	});
}

async function getJson(url: string, signal?: AbortSignal) {
	const res = await fetchWithRetry(url, { signal });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return JSON.parse(await res.text());
}

function toProxyUrl(rawUrl: string) {
	const u = new URL(rawUrl);
	if (!u.searchParams.has("devid")) {
		u.searchParams.set("devid", DEV_ID ?? "");
		u.searchParams.set("devpassword", DEV_PASSWORD ?? "");
		u.searchParams.set("softname", SOFT_NAME);
	}
	const local = `${u.pathname}?${u.searchParams.toString()}`;
	return local.startsWith("/api2/") ? local : `/api2${local}`;
}

/** Real cartridge label from ScreenScraper, or null when unconfigured/unavailable. */
export async function fetchScraperLabel(
	title: string,
	systemId: number,
	searchTerm = title,
	signal?: AbortSignal,
): Promise<Blob | null> {
	if (!DEV_ID || !DEV_PASSWORD) return null;

	// Phase 1 — search for the game id
	const search = await getJson(
		`/api2/jeuRecherche.php?${apiParams({
			systemeid: String(systemId),
			recherche: searchTerm,
		})}`,
		signal,
	);
	const rawJeux = search?.response?.jeux;
	const list = Array.isArray(rawJeux)
		? rawJeux
		: rawJeux?.jeu
			? [].concat(rawJeux.jeu)
			: [];
	const game = list[0];
	if (!game?.id) return null;

	// Phase 2 — full media details
	const info = await getJson(
		`/api2/jeuInfos.php?${apiParams({ gameid: String(game.id) })}`,
		signal,
	);
	const medias = info?.response?.jeu?.medias ?? [];

	// Phase 3 — the cropped cartridge label, best region first
	const stickers = medias.filter(
		(m: { type: string }) => m.type === "support-texture",
	);
	let pick: { url: string; region?: string } | undefined;
	for (const region of REGION_ORDER) {
		pick = stickers.find((m: { region?: string }) => m.region === region);
		if (pick) break;
	}
	pick = pick ?? stickers[0];
	if (!pick?.url) return null;

	const res = await fetchWithRetry(toProxyUrl(pick.url), { signal });
	const type = res.headers.get("content-type") ?? "";
	if (!res.ok || !type.startsWith("image")) return null;
	return res.blob();
}

/** Canvas-generated label used when no real art is available. */
export async function makeFallbackLabel(title: string): Promise<Blob> {
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 448;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("no 2d context");

	ctx.fillStyle = "#0a0a0c";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
	gradient.addColorStop(0, "rgba(212, 175, 55, 0.16)");
	gradient.addColorStop(1, "rgba(212, 175, 55, 0.02)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.strokeStyle = "rgba(212, 175, 55, 0.55)";
	ctx.lineWidth = 3;
	ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

	ctx.fillStyle = "#d4af37";
	ctx.font = "bold 20px 'DM Sans', sans-serif";
	ctx.textAlign = "center";
	ctx.fillText("ROMS.TN", canvas.width / 2, 64);

	ctx.fillStyle = "#f5f2ea";
	ctx.font = "bold 34px 'Syne', sans-serif";
	const words = title.split(" ");
	const lines: string[] = [];
	let line = "";
	for (const word of words) {
		const test = line ? `${line} ${word}` : word;
		if (ctx.measureText(test).width > canvas.width - 96 && line) {
			lines.push(line);
			line = word;
		} else {
			line = test;
		}
	}
	lines.push(line);
	const startY = canvas.height / 2 - (lines.length - 1) * 22;
	lines.forEach((l, i) => {
		ctx.fillText(l, canvas.width / 2, startY + i * 44);
	});

	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
			"image/png",
		),
	);
}
