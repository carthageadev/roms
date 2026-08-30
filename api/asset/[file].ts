/**
 * Vercel serverless function that proxies the cartridge 3D assets.
 * The model and textures stay out of the git repo and are streamed
 * from the origin on demand, with edge caching and a strict whitelist
 * so the endpoint cannot be abused as an open proxy.
 */

const ALLOWED_FILES = new Set([
	"new-n64cart.glb",
	"newbase.jpg",
	"newbase_Normal.tga.png",
	"newbase_Roughness.tga.png",
]);

const ORIGIN_BASE = "https://archive.org/download/7535476";

export default async function handler(
	req: { method?: string; query: Record<string, string | string[]> },
	res: {
		status: (code: number) => {
			setHeader: (name: string, value: string) => void;
			end: () => void;
			send: (body: Buffer) => void;
		};
	},
) {
	if (req.method !== "GET") {
		res.status(405).setHeader("Allow", "GET").end();
		return;
	}

	const file = String(req.query.file ?? "");
	if (!ALLOWED_FILES.has(file)) {
		res.status(404).end();
		return;
	}

	try {
		const upstream = await fetch(`${ORIGIN_BASE}/${encodeURIComponent(file)}`);
		if (!upstream.ok || !upstream.body) {
			res.status(502).end();
			return;
		}

		res
			.status(200)
			.setHeader(
				"Content-Type",
				upstream.headers.get("content-type") ?? "application/octet-stream",
			);
		res.setHeader(
			"Cache-Control",
			"public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
		);
		res.send(Buffer.from(await upstream.arrayBuffer()));
	} catch {
		res.status(502).end();
	}
}
