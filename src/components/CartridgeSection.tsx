import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PLATFORMS } from "../data/games";
import Scene from "./CartridgeScene";

const platform = PLATFORMS[0];
const games = platform.games;

// Cartridge labels are bundled at build time (scraped once via
// scripts/scrape-art.ts into src/assets/art). The landing page never
// hits the ScreenScraper API at runtime.
const bundledLabels = import.meta.glob("../assets/art/n64/*.png", {
	eager: true,
	query: "?url",
	import: "default",
}) as Record<string, string>;

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");

function bundledLabelUrl(title: string, artSlug?: string) {
	return (
		bundledLabels[`../assets/art/n64/${artSlug ?? slug(title)}.png`] ?? null
	);
}

export function CartridgeSection() {
	const [selected, setSelected] = useState(0);
	const [launching, setLaunching] = useState(false);

	// Mutable store read by the 3D frame loop directly; keeps the memoized
	// Scene from re-rendering on selection changes (the keypress hitch).
	const carousel = useRef({ selected: 0, launching: false }).current;
	useEffect(() => {
		carousel.selected = selected;
	}, [selected, carousel]);
	useEffect(() => {
		carousel.launching = launching;
	}, [launching, carousel]);

	const artMap = useMemo(
		() =>
			Object.fromEntries(
				games.map((g) => [g.title, bundledLabelUrl(g.title, g.art)]),
			) as Record<string, string | null>,
		[],
	);

	const pick = useCallback(
		(index: number) =>
			setSelected(((index % games.length) + games.length) % games.length),
		[],
	);
	const step = useCallback(
		(delta: number) =>
			setSelected((prev) => (prev + delta + games.length) % games.length),
		[],
	);
	const launch = useCallback(() => {
		if (carousel.launching) return;
		setLaunching(true);
		setTimeout(() => setLaunching(false), 900);
	}, [carousel]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") step(-1);
			else if (e.key === "ArrowRight") step(1);
			else if (e.key === "Enter") launch();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [step, launch]);

	const game = games[selected];

	return (
		<section className="relative px-6 py-40" id="library">
			<div className="mx-auto max-w-7xl">
				<header className="mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end">
					<div className="max-w-xl">
						<h2 className="mb-6 font-display font-medium text-4xl tracking-tight md:text-5xl lg:text-6xl">
							The Collection
						</h2>
						<p className="text-lg text-text-secondary leading-relaxed">
							Real cartridges, rendered live in your browser. Browse the shelf
							and insert a cart to play.
						</p>
					</div>
					<p className="font-bold text-[10px] text-text-dim uppercase tracking-[0.4em]">
						{platform.name} / {games.length} Carts
					</p>
				</header>

				<div className="glass-panel relative h-[500px] overflow-hidden rounded-3xl border border-white/5 md:h-[620px]">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.06),transparent_65%)]" />
					<Scene
						artMap={artMap}
						carousel={carousel}
						games={games}
						onLaunch={launch}
						onPick={pick}
					/>

					{/* HUD */}
					<div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-6">
						<span className="font-bold text-[10px] text-text-dim uppercase tracking-[0.3em]">
							{String(selected + 1).padStart(2, "0")} /{" "}
							{String(games.length).padStart(2, "0")}
						</span>
						<span className="font-bold text-[10px] text-text-dim uppercase tracking-[0.3em]">
							{platform.name}
						</span>
					</div>

					<div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-6 pt-20">
						<h3 className="font-bold font-display text-2xl tracking-tight md:text-3xl">
							{game.title}
						</h3>
						<div className="pointer-events-auto flex items-center gap-4">
							<button
								aria-label="Previous cartridge"
								className="glass-panel flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-lg transition-colors hover:bg-white/10"
								onClick={() => step(-1)}
								type="button"
							>
								←
							</button>
							<button
								className="btn-luxe btn-primary !rounded-xl"
								onClick={launch}
								type="button"
							>
								Insert Cartridge
							</button>
							<button
								aria-label="Next cartridge"
								className="glass-panel flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-lg transition-colors hover:bg-white/10"
								onClick={() => step(1)}
								type="button"
							>
								→
							</button>
						</div>
						<p className="font-bold text-[9px] text-text-dim uppercase tracking-[0.3em]">
							Arrow keys to browse / Enter to insert
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
