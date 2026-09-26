import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LibraryRack } from "../components/library-rack";
import { Cover, Eyebrow, SaveButton } from "../components/ui";
import { useRomIndex } from "../lib/rom-index-context";
import { featuredRoms, formatSizeMb, romView } from "../lib/rom-view";
import { useLibraryState } from "../lib/use-library";

export default function LibraryPage() {
	const { view } = useRomIndex();
	const { saves } = useLibraryState();

	const rows = useMemo(
		() =>
			Object.entries(saves)
				.map(([id, entry]) => {
					const rom = view.byId.get(id);
					return rom ? { rom, game: romView(rom), entry } : null;
				})
				.filter((row): row is NonNullable<typeof row> => row !== null)
				.sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt)),
		[saves, view.byId],
	);

	const totalMb = rows.reduce((total, row) => total + (row.game.sizeMb ?? 0), 0);
	const suggested = useMemo(() => featuredRoms(view.roms, 6), [view.roms]);

	return (
		<div className="mx-auto max-w-[980px] px-5 pb-12 pt-28 sm:pt-32">
			<div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.16] pb-5">
				<h1 className="text-[38px] font-semibold tracking-[-0.05em] text-white sm:text-[48px]">Your library</h1>
				{rows.length > 0 && (
					<p className="pb-1 text-[13px] text-white/62">
						{rows.length} {rows.length === 1 ? "record" : "records"} - {formatSizeMb(totalMb)}
					</p>
				)}
			</div>

			{rows.length === 0 ? (
				<div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
					<div className="panel flex flex-col justify-between rounded-2xl p-8">
						<div>
							<Eyebrow>Zero State // Ready</Eyebrow>
							<h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-strong">
								Your preservation rack is empty.
							</h2>
							<p className="mt-2.5 max-w-[420px] text-[13.5px] leading-[1.65] text-white/66">
								Save individual dumps straight from the shared index and they will live here, on this device,
								with a status, a pin and a log note.
							</p>
						</div>
						<div className="mt-8 flex flex-wrap items-center gap-3">
							<Link
								to="/browse"
								className="inline-flex h-11 items-center rounded-full border border-white/[0.1] px-5 text-[12.5px] text-white/65 transition-colors hover:border-white/30 hover:text-white"
							>
								Browse index →
							</Link>
							<Link
								to="/platforms"
								className="inline-flex h-11 items-center rounded-full border border-white/[0.1] px-5 text-[12.5px] text-white/65 transition-colors hover:border-white/30 hover:text-white"
							>
								Browse by system
							</Link>
						</div>
					</div>

					<div className="rounded-2xl border border-white/[0.1] bg-[#0b0b0f] p-6">
						<div className="flex items-center justify-between">
							<Eyebrow>Quick-save from the index</Eyebrow>
							<span className="font-mono text-[11px] text-white/48">1-CLICK SAVE</span>
						</div>
						<div className="mt-4 divide-y divide-white/[0.08]">
							{suggested.length === 0 ? (
								<p className="py-6 text-[13px] text-white/60">Loading the shared index…</p>
							) : (
								suggested.map((rom) => {
									const game = romView(rom);
									return (
										<div key={rom.id} className="flex items-center justify-between gap-3 py-2.5">
											<div className="flex min-w-0 items-center gap-3">
												<Cover view={game} className="h-10 w-12 shrink-0" compact />
												<div className="min-w-0">
													<Link
														to={`/rom/${game.slug}`}
														className="block truncate text-[13px] font-medium text-white/88 hover:text-white"
													>
														{game.title}
													</Link>
													<p className="truncate font-mono text-[11.5px] text-white/58">
														{game.platform} - {game.publisher} - {formatSizeMb(game.sizeMb)}
													</p>
												</div>
											</div>
											<SaveButton romId={game.id} />
										</div>
									);
								})
							)}
						</div>
					</div>
				</div>
			) : (
				<LibraryRack />
			)}
		</div>
	);
}
