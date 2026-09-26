import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Cover } from "../components/ui";
import { MetalHeadline, MetalLink, MetalSearchConsole } from "../components/metal";
import { useRomIndex } from "../lib/rom-index-context";
import { featuredRoms, romView } from "../lib/rom-view";
import { useLibraryState } from "../lib/use-library";

export default function HomePage() {
	const { view, total, loading, error } = useRomIndex();
	const { saves, collections } = useLibraryState();
	const savedRows = Object.keys(saves).length;

	const featured = useMemo(() => featuredRoms(view.roms, 4), [view.roms]);

	return (
		<div className="overflow-hidden">
			<section className="relative flex min-h-[78vh] items-center justify-center px-5 pb-12 pt-24">
				<div aria-hidden className="zen-orbit zen-orbit-one" />
				<div aria-hidden className="zen-orbit zen-orbit-two" />
				<div aria-hidden className="zen-orbit zen-orbit-three" />
				<div aria-hidden className="zen-star" />

				<div className="relative w-full max-w-[760px] text-center">
					<h1 className="fade-up text-[52px] leading-[.9] tracking-[-0.065em] sm:text-[76px] lg:text-[96px]">
						<span className="block font-semibold text-white">The games</span>
						<MetalHeadline>you return to.</MetalHeadline>
					</h1>
					<p
						className="fade-up mx-auto mt-8 max-w-[460px] text-[16px] leading-[1.7] text-white/78"
						style={{ animationDelay: "80ms" }}
					>
						Find them. Keep them close. Put them together when they have something to say.
					</p>

					<div className="fade-up mt-10 text-left" style={{ animationDelay: "130ms" }}>
						<MetalSearchConsole totalTitles={total} />
					</div>

					<p className="fade-up mt-5 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-white/40" style={{ animationDelay: "150ms" }}>
						{error
							? "data index unreachable — browse once you are back online"
							: loading
								? "fetching the shared index…"
								: `${total.toLocaleString()} records in the shared index`}
					</p>

					<div className="fade-up mt-7 flex items-center justify-center gap-6" style={{ animationDelay: "170ms" }}>
						<MetalLink href="/browse" preset="chromatic">
							Start exploring
						</MetalLink>
						<Link
							to="/collections"
							className="text-[13px] text-white/75 underline decoration-white/30 underline-offset-4 hover:text-white"
						>
							Make a list
						</Link>
					</div>
				</div>
			</section>

			<section className="mx-auto grid max-w-[860px] gap-12 px-5 pb-8 md:grid-cols-2">
				<Link to="/library" className="group border-t border-white/[0.16] pt-5">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white group-hover:text-sky-100">Library</h2>
							<p className="mt-2 max-w-[290px] text-[14px] leading-relaxed text-white/68">
								A place for the games you want to keep nearby.
							</p>
						</div>
						<span className="mt-1 font-mono text-[15px] text-white/58">{savedRows || "—"}</span>
					</div>
				</Link>

				<Link to="/collections" className="group border-t border-white/[0.16] pt-5">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white group-hover:text-amber-100">Lists</h2>
							<p className="mt-2 max-w-[290px] text-[14px] leading-relaxed text-white/68">
								A thought, a feeling, a handful of games.
							</p>
						</div>
						<span className="mt-1 font-mono text-[15px] text-white/58">{collections.length || "—"}</span>
					</div>
				</Link>
			</section>

			<section className="mx-auto max-w-[860px] px-5 pb-2 pt-16">
				<div className="flex items-center justify-between border-b border-white/[0.16] pb-4">
					<h2 className="text-[18px] font-medium text-white">Begin anywhere</h2>
					<Link to="/browse" className="text-[12px] text-white/65 hover:text-white">
						See all
					</Link>
				</div>
				{featured.length === 0 ? (
					<div className="py-10 text-[15px] text-white/65">
						{loading ? "Loading the shared index…" : "The shared index has no records yet."}
					</div>
				) : (
					<div className="divide-y divide-white/[0.1]">
						{featured.map((rom) => {
							const game = romView(rom);
							return (
								<Link key={rom.id} to={`/rom/${game.slug}`} className="group flex items-center gap-4 py-4">
									<Cover view={game} className="h-12 w-14 shrink-0" compact />
									<div className="min-w-0 flex-1">
										<p className="truncate text-[15px] font-medium text-white group-hover:text-sky-100">{game.title}</p>
										<p className="mt-0.5 text-[12px] text-white/58">
											{game.platform} - {game.publisher}
										</p>
									</div>
									<span className="text-white/45 group-hover:text-white">→</span>
								</Link>
							);
						})}
					</div>
				)}
			</section>
		</div>
	);
}
