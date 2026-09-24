import type { RomEntry } from "../lib/atlas";

/**
 * Product of the Week - hero metallic card.
 * Deterministic weekly pick from the shared Atlas index (no new scraper).
 */
export function SpotlightCard({
	rom,
	year,
	week,
}: {
	rom: RomEntry;
	year: number;
	week: number;
}) {
	return (
		<section
			aria-label="Product of the week"
			className="metallic-spotlight relative overflow-hidden p-8 md:p-12"
		>
			<div className="shine" aria-hidden="true" />
			<div className="relative z-10 flex flex-col gap-10 md:flex-row md:items-center">
				<div className="flex-1">
					<div className="mb-6 inline-flex items-center gap-3">
						<span className="rounded-full bg-gradient-to-r from-[#f6e27a] via-[#fffbe6] to-[#c3a069] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-black">
							Product of the week
						</span>
						<span className="text-[10px] font-bold uppercase tracking-[0.3em] text-text-dim">
							W{String(week).padStart(2, "0")} · {year}
						</span>
					</div>
					<h2 className="mb-4 font-display text-4xl font-medium tracking-tight md:text-5xl">
						{rom.title}
					</h2>
					<p className="mb-6 text-sm uppercase tracking-[0.25em] text-text-secondary">
						{rom.company}
						{rom.console ? ` - ${rom.console}` : ""}
					</p>
					<p className="mb-8 max-w-xl truncate text-sm text-text-dim">
						{rom.folder}
						{rom.size ? ` · ${rom.size}` : ""}
						{rom.date ? ` · ${rom.date}` : ""}
					</p>
					<div className="flex flex-wrap items-center gap-4">
						<a
							className="btn-luxe btn-primary !rounded-xl"
							download
							href={rom.url}
						>
							Download ROM
						</a>
						<a
							className="btn-luxe btn-outline !rounded-xl"
							href={rom.url}
						>
							Raw link
						</a>
					</div>
				</div>
				<div className="flex-1">
					<div className="glass-panel mx-auto max-w-[380px] p-6 text-center">
						<div className="mb-2 text-[10px] font-black uppercase tracking-[0.4em] text-accent-gold">
							Weekly metallic pick
						</div>
						<div className="font-display text-2xl font-bold">{rom.title}</div>
						<div className="mt-2 text-xs uppercase tracking-widest text-text-secondary">
							{rom.company} · {rom.console || "multi"} · {rom.size || "-"}
						</div>
						<div className="mt-6 h-[6px] overflow-hidden rounded-full bg-white/10">
							<div className="h-full w-full bg-gradient-to-r from-[#8a6a2f] via-[#f6e27a] to-[#8a6a2f]" />
						</div>
						<p className="mt-4 text-[11px] leading-relaxed text-text-dim">
							Auto-rotates every Monday from the same Atlas index that powers
							search below. No extra scraper - same data, same hash.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
