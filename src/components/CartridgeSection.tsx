import { useState } from "react";

const CARTRIDGES = [
	{ title: "Pokemon Stadium", art: "pokemon-stadium" },
	{ title: "Pokemon Snap", art: "pokemon-snap" },
	{ title: "Mario Party", art: "mario-party" },
	{ title: "Castlevania", art: "castlevania" },
	{ title: "Bomberman 64", art: "bomberman-64" },
	{ title: "Super Mario 64", art: "super-mario-64" },
	{ title: "Mario Kart 64", art: "mario-kart-64" },
	{ title: "Ocarina of Time", art: "ocarina-of-time" },
	{ title: "Star Fox 64", art: "star-fox-64" },
	{ title: "GoldenEye 007", art: "goldeneye-007" },
	{ title: "Banjo-Kazooie", art: "banjo-kazooie" },
	{ title: "Donkey Kong 64", art: "donkey-kong-64" },
];

export function CartridgeSection() {
	const [selected, setSelected] = useState(0);
	const game = CARTRIDGES[selected];

	const step = (delta: number) =>
		setSelected((prev) => (prev + delta + CARTRIDGES.length) % CARTRIDGES.length);

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
						Nintendo 64 / {CARTRIDGES.length} Carts
					</p>
				</header>

				<div className="glass-panel relative overflow-hidden rounded-3xl border border-white/5 p-8">
					<div className="flex flex-col items-center gap-8 md:flex-row">
						<div className="flex-1">
							<div className="mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-black/40">
								<img
									alt={`${game.title} cartridge label`}
									className="h-full w-full object-cover"
									src={`/api/asset/n64/${game.art}.png`}
								/>
							</div>
						</div>

						<div className="flex flex-1 flex-col items-center gap-6 text-center">
							<span className="font-bold text-[10px] text-text-dim uppercase tracking-[0.3em]">
								{String(selected + 1).padStart(2, "0")} / {String(CARTRIDGES.length).padStart(2, "0")}
							</span>
							<h3 className="font-display font-bold text-3xl tracking-tight md:text-4xl">
								{game.title}
							</h3>
							<div className="flex items-center gap-4">
								<button
									aria-label="Previous cartridge"
									className="glass-panel flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-lg transition-colors hover:bg-white/10"
									onClick={() => step(-1)}
									type="button"
								>
									←
								</button>
								<button className="btn-luxe btn-primary !rounded-xl" type="button">
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
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
