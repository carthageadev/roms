import { Link } from "@tanstack/react-router";
import { ConsoleGrid } from "../components/ConsoleGrid";
import { Hero } from "../components/Hero";
import { Navbar } from "../components/Navbar";

export function HomePage() {
	return (
		<main className="relative min-h-screen">
			<Navbar />
			<Hero />

			{/* Subtle Accent Line */}
			<div className="flex w-full justify-center overflow-hidden px-6 py-20">
				<div className="h-[1px] w-full max-w-7xl bg-gradient-to-r from-transparent via-glass-border to-transparent" />
			</div>

			<ConsoleGrid />

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

						<div className="relative aspect-square flex-1">
							<div className="absolute inset-0 rounded-full bg-accent-gold/5 blur-[100px]" />
							<div className="glass-panel relative flex h-full w-full items-center justify-center overflow-hidden p-12 shadow-2xl">
								<div className="flex h-full w-full animate-float items-center justify-center rounded-lg border border-white/5 bg-void/40">
									{/* Placeholder for high-end graphic */}
									<div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10">
										<div className="h-12 w-12 rounded-full bg-white/5" />
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-12 md:grid-cols-3">
						{[
							{
								title: "Metroid Prime",
								label: "GameCube",
								color: "bg-blue-900/40",
							},
							{
								title: "Metal Gear Solid 2",
								label: "PlayStation 2",
								color: "bg-gray-800/40",
							},
							{
								title: "Shenmue",
								label: "Dreamcast",
								color: "bg-orange-900/40",
							},
						].map((game) => (
							<div className="group cursor-pointer" key={game.title}>
								<div className="glass-panel mb-8 aspect-[16/10] overflow-hidden">
									<div
										className={`h-full w-full ${game.color} blur-xl transition-transform duration-[2s] group-hover:scale-110`}
									/>
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

			{/* Footer - Elegant & Concise */}
			<footer className="border-glass-border border-t bg-deep py-32">
				<div className="mx-auto max-w-7xl px-6">
					<div className="mb-20 flex flex-col items-center justify-between gap-12 md:flex-row">
						<div className="flex items-center gap-3">
							<div className="h-6 w-6 rounded bg-white" />
							<span className="font-display font-medium text-2xl tracking-tight">
								rom.tn
							</span>
						</div>
						<ul className="flex flex-wrap items-center justify-center gap-10 font-bold text-[10px] text-text-dim uppercase tracking-[0.3em]">
							<li>
								<a
									className="transition-colors hover:text-white"
									href="#archive"
								>
									Archive
								</a>
							</li>
							<li>
								<a className="transition-colors hover:text-white" href="#dev">
									API
								</a>
							</li>
							<li>
								<Link
									className="transition-colors hover:text-white"
									to="/legal"
								>
									Copyright
								</Link>
							</li>
							<li>
								<a
									className="transition-colors hover:text-white"
									href="#discord"
								>
									Discord
								</a>
							</li>
						</ul>
					</div>

					<div className="text-center font-bold text-[10px] text-text-dim uppercase tracking-[0.5em] opacity-50">
						Preserving Virtual History — All Rights Reserved 2026
					</div>
				</div>
			</footer>
		</main>
	);
}
