const API = "https://www.screenscraper.fr/api2";
const LABEL_REGIONS = ["eu", "us", "wor", "ss", "jp"];

interface Creds {
	id: string;
	password: string;
	soft: string;
}

function creds(): Creds | null {
	const id = process.env.SCREENSCRAPER_DEV_ID?.trim();
	const password = process.env.SCREENSCRAPER_DEV_PASSWORD?.trim();
	const soft = process.env.SCREENSCRAPER_SOFT_NAME?.trim() || "roms-tn";
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
	const res = await fetch(`${API}/${endpoint}?${qs}`, { signal: AbortSignal.timeout(12000) });
	const text = await res.text();
	if (!res.ok) throw new Error(`ScreenScraper ${res.status}`);
	return JSON.parse(text) as unknown;
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

/**
 * Resolve box art for a single title at the moment it joins the library.
 * Returns null when unconfigured or unresolvable — callers keep a placeholder.
 * ScreenScraper answers slowly and throttles aggressive clients, so callers
 * pass a budget instead of hanging on art.
 */
export async function fetchGameCover(title: string, budgetMs = 15000): Promise<string | null> {
  const c = creds();
  if (!c || !title.trim()) return null;
  const budget = new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs));
  return Promise.race([lookup(title.trim(), c), budget]);
}

async function lookup(title: string, c: Creds): Promise<string | null> {
	try {
		const data = (await ssRequest("jeuRecherche.php", { recherche: title }, c)) as {
			response?: { jeux?: unknown };
		};
		const jeux = asArray(data?.response?.jeux as Array<{ id?: number | string }>);
		const first = jeux.find((j) => j?.id != null);
		if (!first) return null;
		const info = (await ssRequest("jeuInfos.php", { gameid: String(first.id) }, c)) as {
			response?: { jeu?: { medias?: unknown } };
		};
		return pickLabelUrl(info?.response?.jeu?.medias);
	} catch {
		return null;
	}
}
