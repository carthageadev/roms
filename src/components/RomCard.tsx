import type { RomEntry } from "../lib/atlas";

function copyUrl(url: string, el: HTMLButtonElement) {
	try {
		void navigator.clipboard.writeText(url);
		el.textContent = "ok";
		setTimeout(() => {
			el.textContent = "copy";
		}, 1200);
	} catch {
		el.textContent = "err";
	}
}

export function RomCard({ rom }: { rom: RomEntry }) {
	return (
		<article className="metallic-card group flex flex-col justify-between p-5">
			<div className="min-w-0">
				<a
					className="mb-3 block truncate font-display font-bold text-[15px] text-white transition-colors hover:text-accent-gold"
					download
					href={rom.url}
					title={rom.title}
				>
					{rom.title}
				</a>
				<div className="mb-4 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim">
					<span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
						{rom.company || "-"}
					</span>
					{rom.console ? (
						<span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
							{rom.console}
						</span>
					) : null}
					{rom.size ? (
						<span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 normal-case tracking-normal">
							{rom.size}
						</span>
					) : null}
					{rom.date ? (
						<span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 normal-case tracking-normal">
							{rom.date}
						</span>
					) : null}
				</div>
				<p className="truncate text-xs text-text-secondary" title={rom.folder}>
					{rom.folder}
				</p>
			</div>
			<div className="mt-5 flex items-center gap-2">
				<a
					className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-[11px] font-black uppercase tracking-widest text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
					href={rom.url}
				>
					Raw
				</a>
				<a
					className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-[11px] font-black uppercase tracking-widest text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
					download
					href={rom.url}
				>
					DL
				</a>
				<button
					className="flex-1 rounded-xl bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.03]"
					onClick={(e) => copyUrl(rom.url, e.currentTarget)}
					type="button"
				>
					Copy
				</button>
			</div>
		</article>
	);
}
