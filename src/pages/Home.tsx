import { Link } from "@tanstack/react-router";
import { CartridgeSection } from "../components/CartridgeSection";
import { Hero } from "../components/Hero";
import { Navbar } from "../components/Navbar";

const covers = import.meta.glob("../assets/art/covers/*.png", {
	eager: true,
	query: "?url",
	import: "default",
}) as Record<string, string>;

const cover = (slug: string) => covers[`../assets/art/covers/${slug}.png`];

export function HomePage() {
	return (
		<main className="relative min-h-screen">
			<Navbar />
			<Hero />

			{/* Subtle Accent Line */}
			<div className="flex w-full justify-center overflow-hidden px-6 py-20">
				<div className="h-[1px] w-full max-w-7xl bg-gradient-to-r from-transparent via-glass-border to-transparent" />
			</div>

			<CartridgeSection />

			{/* Featured Section - Museum/Gallery Style */}
			<section className="bg-surface/30 py-40">
				<div className="mx-auto max-w-7xl px-6">
					<div className="mb-32 flex flex-col items-center gap-20 md:flex-row">
						<div className="flex-1">
							<div className="mb-8 font-black text-[10px] text-accent-gold uppercase tracking-[0.4em]">
								Featured Artifact
							</div>
							<h2 className="mb-10 font-display font-medium text-5xl tracking-tight md:text-6xl lg:text-7xl">
								The Ocarina <br />
								<span className="opacity-50">of Time</span>
							</h2>
							<p className="mb-12 text-lg text-text-secondary leading-relaxed">
								Often cited as the greatest game of all time, now preserved in
								4K bit-perfect resolution. Experience the masterpiece as it was
								intended—but with the fidelity of today.
							</p>
							<div className="flex items-center gap-10">
								<button
									className="btn-luxe btn-primary !rounded-xl"
									type="button"
								>
									Enter Hyrule
								</button>
								<div className="flex flex-col">
									<span className="font-bold text-[9px] text-text-dim uppercase tracking-widest">
										Release
									</span>
									<span className="font-medium text-sm">Nov 21, 1998</span>
								</div>
							</div>
						</div>

					<div className="relative flex-1">
						<div className="absolute inset-0 rounded-full bg-accent-gold/5 blur-[100px]" />
						<div className="glass-panel relative mx-auto aspect-[3/4] w-full max-w-[380px] overflow-hidden rounded-3xl border border-white/10 p-4 shadow-2xl">
							<div className="h-full w-full overflow-hidden rounded-2xl border border-white/5">
								<img
									alt="The Legend of Zelda Ocarina of Time cover art"
									className="h-full w-full object-contain"
									src={cover("ocarina-of-time")}
								/>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-20 grid grid-cols-1 gap-12 md:grid-cols-3">
					{[
						{ title: "Metroid Prime", label: "GameCube", art: "metroid-prime" },
						{
							title: "Metal Gear Solid 2",
							label: "PlayStation 2",
							art: "metal-gear-solid-2",
						},
						{ title: "Shenmue", label: "Dreamcast", art: "shenmue" },
					].map((game) => (
						<div className="group cursor-pointer" key={game.title}>
							<div className="glass-panel mb-8 overflow-hidden rounded-3xl border border-white/10 p-2 transition-all duration-150 group-hover:border-white/20 group-hover:shadow-lg">
								<div className="aspect-[4/3] overflow-hidden rounded-2xl border border-white/5">
									<img
										alt={`${game.title} cover art`}
										className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
										src={cover(game.art)}
									/>
								</div>
							</div>
							<div className="flex items-center justify-between px-2">
								<h3 className="font-bold font-display text-xl">
									{game.title}
								</h3>
								<span className="font-bold text-[10px] text-text-secondary uppercase tracking-widest">
									{game.label}
								</span>
							</div>
						</div>
					))}
				</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-glass-border border-t bg-deep py-24">
				<div className="mx-auto max-w-7xl px-6">
					<div className="mb-16 flex flex-col items-center gap-12 md:flex-row md:items-start md:justify-between">
						<div className="flex flex-col items-center gap-4 md:items-start">
							<div className="flex items-center gap-3">
								<img alt="" className="h-7 w-7" src="/icon.svg" />
								<span className="font-display font-medium text-2xl tracking-tight">
									roms.tn
								</span>
							</div>
							<p className="max-w-xs text-center text-sm text-text-secondary leading-relaxed md:text-left">
								Preserving the legacy of classic gaming. Play thousands of
								retro titles directly in your browser.
							</p>
						</div>

						<div className="flex flex-wrap items-center justify-center gap-10 font-bold text-[10px] text-text-dim uppercase tracking-[0.3em]">
							<a className="transition-colors hover:text-white" href="#library">
								Library
							</a>
							<Link className="transition-colors hover:text-white" to="/about">
								About
							</Link>
							<Link className="transition-colors hover:text-white" to="/legal">
								Legal
							</Link>
							<a
								className="transition-colors hover:text-white"
								href="#discord"
							>
								Discord
							</a>
						</div>
					</div>

					<div className="flex flex-col items-center justify-between gap-6 border-t border-glass-border pt-10 md:flex-row">
						<span className="font-bold text-[10px] text-text-dim uppercase tracking-[0.4em]">
							All Rights Reserved 2026
						</span>
						<button
							className="glass-panel flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition-colors hover:bg-white/10"
							onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
							type="button"
						>
							↑
						</button>
					</div>
				</div>
			</footer>
		</main>
	);
}
