import { existsSync, readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const CARTRIDGE_ART_DIR = join(process.cwd(), ".cartridge-logic/src-assets/art");

function cartridgeArtProxy(): Plugin {
	return {
		name: "cartridge-art-proxy",
		configureServer(server) {
			server.middlewares.use("/api/asset/n64", (req, res: ServerResponse) => {
				const file = decodeURIComponent((req.url ?? "").replace(/^\//, ""));
				const filePath = join(CARTRIDGE_ART_DIR, "n64", file);
				if (!existsSync(filePath)) {
					res.statusCode = 404;
					res.end();
					return;
				}
				res.setHeader("Content-Type", "image/png");
				res.setHeader("Cache-Control", "public, max-age=86400");
				res.end(readFileSync(filePath));
			});
		},
	};
}

export default defineConfig({
	plugins: [react(), tailwindcss(), cartridgeArtProxy()],
});
