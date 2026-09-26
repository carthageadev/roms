import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MetalShell } from "../components/metal";
import { Cover } from "../components/ui";
import { createList } from "../lib/library-store";
import { useRomIndex } from "../lib/rom-index-context";
import { formatSizeMb, romView } from "../lib/rom-view";
import { useLibraryState } from "../lib/use-library";

export default function CollectionsPage() {
	const { view } = useRomIndex();
	const { collections } = useLibraryState();
	const [name, setName] = useState("");
	const navigate = useNavigate();

	const summaries = useMemo(
		() =>
			collections.map((collection) => {
				const roms = collection.items
					.map((item) => view.byId.get(item.romId))
					.filter((rom): rom is NonNullable<typeof rom> => Boolean(rom));
				return {
					collection,
					count: collection.items.length,
					covers: roms.slice(0, 3).map(romView),
					totalMb: roms.reduce((total, rom) => total + (romView(rom).sizeMb ?? 0), 0),
				};
			}),
		[collections, view.byId],
	);

	return (
		<div className="mx-auto max-w-[980px] px-5 pb-14 pt-28 sm:pt-32">
			<section className="max-w-[600px]">
				<h1 className="text-[42px] font-semibold leading-[.98] tracking-[-0.05em] text-white sm:text-[56px]">
					Make a small world
					<br />
					<span className="text-white/58">around the games you love.</span>
				</h1>
				<p className="mt-5 max-w-[520px] text-[15px] leading-[1.7] text-white/72">
					A list can be a mood, a year, a studio, or one perfect weekend. Start with a name. The rest can arrive
					slowly.
				</p>
			</section>

			<section className="mt-12 border-y border-white/[0.14] py-6">
				<form
					className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
					onSubmit={(event) => {
						event.preventDefault();
						const id = createList({ name: name.trim() || "Untitled list", curator: "You", preset: "chromatic" });
						setName("");
						navigate(`/collections/${id}`);
					}}
				>
					<div className="border-b border-white/[0.25] pb-2 focus-within:border-white">
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							maxLength={80}
							placeholder="Name a list…"
							aria-label="Name a list"
							className="w-full bg-transparent text-[19px] text-white placeholder:text-white/35 focus:outline-none"
						/>
					</div>
					<MetalShell preset="chromatic" strength={0.9}>
						<button
							type="submit"
							className="inline-flex h-10 items-center gap-2 rounded-full bg-transparent px-5 text-[12px] font-medium text-white"
						>
							Create it <span>→</span>
						</button>
					</MetalShell>
				</form>
			</section>

			<section className="mt-12">
				<div className="flex items-baseline justify-between gap-4">
					<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/62">Your lists</p>
					<span className="font-mono text-[11px] text-white/52">{String(collections.length).padStart(2, "0")}</span>
				</div>

				{summaries.length === 0 ? (
					<div className="mt-5 border-t border-white/[0.14] py-9">
						<p className="text-[17px] text-white/80">Nothing here yet.</p>
						<p className="mt-2 max-w-[400px] text-[13px] leading-relaxed text-white/60">
							Start with a title above, then file records into it from any game page.
						</p>
					</div>
				) : (
					<div className="mt-3 divide-y divide-white/[0.1] border-y border-white/[0.14]">
						{summaries.map(({ collection, count, covers, totalMb }) => (
							<Link
								key={collection.id}
								to={`/collections/${collection.id}`}
								className="group flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="min-w-0">
									<p className="text-[21px] font-semibold tracking-[-0.03em] text-white group-hover:text-amber-100">
										{collection.name}
									</p>
									<p className="mt-1 max-w-[560px] truncate text-[13px] text-white/62">
										{collection.note || "A list still finding its shape."}
									</p>
								</div>
								<div className="flex items-center gap-4">
									<div className="flex -space-x-2">
										{covers.map((game) => (
											<Cover key={game.id} view={game} className="h-8 w-9 border border-[#060608]" compact />
										))}
									</div>
									<span className="min-w-[110px] text-right font-mono text-[11px] text-white/58">
										{count} {count === 1 ? "game" : "games"} - {formatSizeMb(totalMb)}
									</span>
									<span className="text-white/52 group-hover:text-white">→</span>
								</div>
							</Link>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
