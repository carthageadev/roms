import type { ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const ALLOWED_ASSETS = new Set([
	"new-n64cart.glb",
	"newbase.jpg",
	"newbase_Normal.tga.png",
	"newbase_Roughness.tga.png",
]);

const ORIGIN_BASE = "https://archive.org/download/7535476";

// Dev-only mirror of the Vercel function in api/asset/[file].ts. Uses fetch
// (which follows archive.org's datanode redirects) and streams the body back
// same-origin, avoiding CORS entirely.
function archiveAssetProxy(): Plugin {
	const memoryCache = new Map<string, Buffer>();
	return {
		name: "archive-asset-proxy",
		configureServer(server) {
			server.middlewares.use("/api/asset", (req, res: ServerResponse) => {
				const file = decodeURIComponent((req.url ?? "").replace(/^\//, ""));
				if (!ALLOWED_ASSETS.has(file)) {
					res.statusCode = 404;
					res.end();
					return;
				}
				const cached = memoryCache.get(file);
				if (cached) {
					res.end(cached);
					return;
				}
				fetch(`${ORIGIN_BASE}/${file}`)
					.then(async (up) => {
						if (!up.ok) {
							res.statusCode = 502;
							res.end();
							return;
						}
						const buf = Buffer.from(await up.arrayBuffer());
						memoryCache.set(file, buf);
						res.setHeader(
							"Content-Type",
							up.headers.get("content-type") ?? "application/octet-stream",
						);
						res.end(buf);
					})
					.catch(() => {
						res.statusCode = 502;
						res.end();
					});
			});
		},
	};
}

export default defineConfig({
	plugins: [react(), tailwindcss(), archiveAssetProxy()],
});
