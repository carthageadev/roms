import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Cover } from "../components/ui";
import { useRomIndex } from "../lib/rom-index-context";
import { consoleStats, romView, topCompanies } from "../lib/rom-view";

export default function PlatformsPage() {
	const { view, loading } = useRomIndex();
	const consoles = useMemo(() => consoleStats(view.roms), [view.roms]);
	const companies = useMemo(() => topCompanies(view.roms, 40), [view.roms]);

	return (
		<div className="mx-auto max-w-[980px] px-5 pb-14 pt-28 sm:pt-32">
			<h1 className="text-[38px] font-semibold tracking-[-0.05em] text-white sm:text-[48px]">Systems</h1>
			<p className="mt-3 max-w-[560px] text-[14px] leading-relaxed text-white/62">
				Every console the shared index reports, straight from the loaded data. No catalogue is stored in this app.
			</p>

			{loading && consoles.length === 0 ? (
				<div className="py-20 text-center text-[15px] text-white/65">Loading the shared index…</div>
			) : consoles.length === 0 ? (
				<div className="py-20 text-center text-[15px] text-white/65">No systems in the shared index yet.</div>
			) : (
				<>
					<div className="mt-8 divide-y divide-white/[0.1] border-y border-white/[0.16]">
						{consoles.map((platform) => {
							const games = view.roms
								.filter((rom) => rom.console === platform.name)
								.slice(0, 4)
								.map(romView);
							return (
								<section
									key={platform.name}
									className="grid gap-5 py-6 lg:grid-cols-[180px_1fr] lg:items-center"
								>
									<Link to={`/browse?console=${encodeURIComponent(platform.name)}`} className="group">
										<h2 className="text-[20px] font-semibold tracking-[-0.03em] text-white group-hover:text-sky-100">
											{platform.name}
										</h2>
										<p className="mt-4 text-[12px] text-white/68">
											{platform.count.toLocaleString()} {platform.count === 1 ? "record" : "records"}
										</p>
									</Link>
									{games.length > 0 ? (
										<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
											{games.map((game) => (
												<Link key={game.id} to={`/rom/${game.slug}`} className="group">
													<Cover view={game} className="aspect-[4/3] w-full" compact />
													<p className="mt-2 truncate text-[12px] text-white/72 group-hover:text-white">{game.title}</p>
												</Link>
											))}
										</div>
									) : null}
								</section>
							);
						})}
					</div>

					<section className="mt-16">
						<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/62">Publishers in the index</p>
						<div className="mt-3 flex flex-wrap gap-2">
							{companies.map((company) => (
								<Link
									key={company.name}
									to={`/browse?company=${encodeURIComponent(company.name)}`}
									className="inline-flex h-8 items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.02] px-3.5 text-[12px] text-white/70 transition-colors hover:border-white/30 hover:text-white"
								>
									{company.name}
									<span className="font-mono text-[10px] text-white/45">{company.count.toLocaleString()}</span>
								</Link>
							))}
						</div>
					</section>
				</>
			)}
		</div>
	);
}
