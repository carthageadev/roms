import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { MetalShell } from "../components/metal";
import { Cover, Eyebrow, SaveButton, StatusPills } from "../components/ui";
import { NOTES_MAX, createList, setNotes, setPinned, toggleListItem, type LibraryStatus } from "../lib/library-store";
import { useLibraryState } from "../lib/use-library";
import { useRomIndex } from "../lib/rom-index-context";
import { findRom, formatSizeMb, romView } from "../lib/rom-view";

export default function RomPage() {
	const { slugOrId = "" } = useParams();
	const { view, loading } = useRomIndex();
	const { saves, collections } = useLibraryState();
	const [newListName, setNewListName] = useState("");
	const [newListNote, setNewListNote] = useState("");
	const [requested, setRequested] = useState(false);

	const rom = useMemo(() => findRom(view, slugOrId), [slugOrId, view]);
	const entry = rom ? saves[rom.id] : undefined;
	const game = rom ? romView(rom) : null;

	const related = useMemo(() => {
		if (!rom) return [];
		return view.roms.filter((candidate) => candidate.console === rom.console && candidate.id !== rom.id).slice(0, 4);
	}, [rom, view.roms]);

	if (!game) {
		return (
			<div className="mx-auto max-w-[860px] px-5 pb-20 pt-32">
				<p className="text-[15px] text-white/80">
					{loading ? "Looking for that record in the shared index…" : "That record is not in the shared index."}
				</p>
				<Link
					to="/browse"
					className="mt-4 inline-block text-[13px] text-white/65 underline underline-offset-4 hover:text-white"
				>
					← Back to the index
				</Link>
			</div>
		);
	}

	const status: LibraryStatus = entry?.status ?? "saved";
	const specs: Array<[string, string]> = [
		["System", game.platform],
		["Released", game.year ? String(game.year) : "—"],
		["Publisher", game.publisher],
		["Footprint", formatSizeMb(game.sizeMb)],
		["Folder", game.folder || "—"],
		["Date", game.date || "—"],
		["Record id", game.id],
		["Index", `d${(game.hue % 100).toString().padStart(2, "0")}`],
	];

	/** Only the explicit Download button touches the source URL. */
	const requestDownload = () => {
		const frame = document.createElement("iframe");
		frame.src = game.url;
		frame.title = `download ${game.title}`;
		frame.setAttribute("aria-hidden", "true");
		frame.style.display = "none";
		document.body.appendChild(frame);
		window.setTimeout(() => frame.remove(), 30000);
		setRequested(true);
		window.setTimeout(() => setRequested(false), 4000);
	};

	return (
		<div className="mx-auto max-w-[1180px] px-5 pb-12 pt-10">
			<nav className="flex items-center gap-2 font-mono text-[11px] text-white/54">
				<Link to="/browse" className="hover:text-white/75">
					Index
				</Link>
				<span>/</span>
				<Link to={`/browse?console=${encodeURIComponent(game.platform)}`} className="hover:text-white/75">
					{game.platform}
				</Link>
				<span>/</span>
				<span className="truncate text-white/76">{game.title}</span>
			</nav>

			<div className="mt-8 grid gap-10 lg:grid-cols-[360px_1fr]">
				<div>
					<div className="scanline relative overflow-hidden rounded-2xl border border-white/[0.11] bg-[#0b0b0f] p-3">
						<Cover view={game} className="aspect-[4/3] w-full" />
					</div>

					<div className="mt-4 flex flex-wrap items-center gap-2.5">
						<MetalShell preset="chromatic" strength={1}>
							<button
								type="button"
								onClick={requestDownload}
								className="inline-flex h-10 items-center gap-2 rounded-full bg-transparent px-5 text-[12px] font-medium text-white"
							>
								{requested ? "✓ Request sent" : "↓ Download from source"}
							</button>
						</MetalShell>
						<SaveButton romId={game.id} />
						<button
							type="button"
							onClick={() => setPinned(game.id, !entry?.pinned)}
							title={entry?.pinned ? "Unpin" : "Pin in your library"}
							className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] transition-colors ${
								entry?.pinned
									? "border-amber-300/40 bg-amber-300/15 text-amber-200"
									: "border-white/[0.12] bg-white/[0.02] text-white/70 hover:border-white/25 hover:text-white"
							}`}
						>
							★
						</button>
					</div>

					<p className="mt-3 text-[11.5px] leading-relaxed text-white/50">
						Downloads open the source file directly from the shared host when you press Download. Nothing is fetched
						while you read this page.
					</p>

					<div className="mt-5 rounded-xl border border-white/[0.1] bg-[#0b0b0f] p-4">
						<div className="flex items-center justify-between">
							<Eyebrow>Library state</Eyebrow>
							<Link to="/library" className="font-mono text-[11px] text-white/58 hover:text-white">
								Open library →
							</Link>
						</div>
						<div className="mt-3">
							<StatusPills romId={game.id} status={status} />
						</div>
						<form
							className="mt-3"
							onSubmit={(event: FormEvent<HTMLFormElement>) => {
								event.preventDefault();
								const data = new FormData(event.currentTarget);
								setNotes(game.id, String(data.get("notes") ?? ""));
							}}
						>
							<div className="flex gap-1.5">
								<input
									name="notes"
									defaultValue={entry?.notes ?? ""}
									maxLength={NOTES_MAX}
									placeholder="Personal log note (revision, clear time)…"
									className="h-8 flex-1 rounded-lg border border-white/10 bg-black/50 px-2.5 text-[11.5px] text-white placeholder:text-white/46 focus:border-white/30 focus:outline-none"
								/>
								<button
									type="submit"
									className="h-8 rounded-lg border border-white/15 bg-white/[0.05] px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white/80 hover:bg-white hover:text-black"
								>
									Log
								</button>
							</div>
						</form>
					</div>

					<div className="mt-4 rounded-xl border border-white/[0.1] bg-[#0b0b0f] p-4">
						<Eyebrow>Source record</Eyebrow>
						<dl className="mt-3 space-y-2 font-mono text-[11.5px]">
							<div className="flex items-start justify-between gap-3">
								<dt className="text-white/48">Source</dt>
								<dd className="break-all text-right text-white/62">http://92.35.124.13</dd>
							</div>
							<div className="flex items-start justify-between gap-3">
								<dt className="text-white/48">Path</dt>
								<dd className="break-all text-right text-white/62">{game.folder || "—"}</dd>
							</div>
							<div className="flex items-start justify-between gap-3">
								<dt className="text-white/48">Size field</dt>
								<dd className="break-all text-right text-white/62">{game.size || "—"}</dd>
							</div>
							<div className="flex items-start justify-between gap-3">
								<dt className="text-white/48">Registry</dt>
								<dd className="text-right text-emerald-300/80">IN INDEX</dd>
							</div>
						</dl>
					</div>
				</div>

				<div>
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-full border border-white/[0.16] px-3 py-1 text-[12px] text-white/82">{game.platform}</span>
						{game.year && (
							<span className="tnum rounded-full border border-white/10 px-2.5 py-0.5 font-mono text-[11px] tracking-[0.12em] text-white/72">
								{game.year}
							</span>
						)}
						<span className="rounded-full border border-white/10 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/68">
							{formatSizeMb(game.sizeMb)}
						</span>
					</div>

					<h1 className="mt-4 max-w-[640px] text-[38px] font-medium leading-[1.06] tracking-[-0.04em] text-white/94">
						{game.title}
					</h1>

					<p className="mt-4 max-w-[620px] text-[14.5px] leading-[1.7] text-white/70">
						{`Filed under ${game.publisher} on ${game.platform}${game.year ? `, dated ${game.year}` : ""}. This page is generated straight from the shared index record — title, company, console, folder, size and date are exactly what the host reports.`}
					</p>

					<dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.06] sm:grid-cols-4">
						{specs.map(([key, value]) => (
							<div key={key} className="bg-[#0b0b0f] px-4 py-3.5">
								<dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/48">{key}</dt>
								<dd className="tnum mt-1 truncate text-[13px] text-white/86" title={value}>
									{value}
								</dd>
							</div>
						))}
					</dl>

					<div id="curate" className="panel mt-8 scroll-mt-20 rounded-2xl p-6">
						<div className="flex items-center justify-between">
							<div>
								<Eyebrow>List filing</Eyebrow>
								<h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-strong">
									Sequence this record into a list
								</h2>
							</div>
							<Link to="/collections" className="font-mono text-[11.5px] text-white/62 hover:text-white">
								All lists →
							</Link>
						</div>

						{collections.length === 0 ? (
							<p className="mt-4 text-[13px] text-white/62">You have no lists yet — name one below to start.</p>
						) : (
							<div className="mt-4 flex flex-wrap gap-2">
								{collections.map((collection) => {
									const contains = collection.items.some((item) => item.romId === game.id);
									return (
										<button
											key={collection.id}
											type="button"
											onClick={() => toggleListItem(collection.id, game.id)}
											className={`inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[12px] transition-all ${
												contains
													? "border-white/70 bg-white font-medium text-black"
													: "border-white/12 bg-white/[0.02] text-white/60 hover:border-white/30 hover:text-white"
											}`}
										>
											<span className="font-mono text-[11px]">{contains ? "✓" : "+"}</span>
											<span className="max-w-[140px] truncate">{collection.name}</span>
										</button>
									);
								})}
							</div>
						)}

						<form
							className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
							onSubmit={(event) => {
								event.preventDefault();
								const trimmed = newListName.trim();
								if (!trimmed) return;
								createList({
									name: trimmed,
									note: newListNote.trim(),
									romIds: [game.id],
									curator: "You",
									preset: "chromatic",
								});
								setNewListName("");
								setNewListNote("");
							}}
						>
							<input
								value={newListName}
								onChange={(event) => setNewListName(event.target.value)}
								maxLength={80}
								placeholder="New list title…"
								aria-label="New list title"
								className="h-9 rounded-full border border-white/10 bg-black/50 px-4 text-[12.5px] text-white placeholder:text-white/46 focus:border-white/30 focus:outline-none"
							/>
							<input
								value={newListNote}
								onChange={(event) => setNewListNote(event.target.value)}
								maxLength={280}
								placeholder="Optional curatorial note…"
								aria-label="Optional curatorial note"
								className="h-9 rounded-full border border-white/10 bg-black/50 px-4 text-[12.5px] text-white placeholder:text-white/46 focus:border-white/30 focus:outline-none"
							/>
							<button
								type="submit"
								className="h-9 rounded-full bg-white px-5 text-[12px] font-medium text-black transition-opacity hover:opacity-90"
							>
								Mint &amp; file →
							</button>
						</form>
					</div>
				</div>
			</div>

			{related.length > 0 && (
				<section className="mt-20">
					<Eyebrow>More from {game.platform}</Eyebrow>
					<div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
						{related.map((candidate) => {
							const other = romView(candidate);
							return (
								<Link
									key={candidate.id}
									to={`/rom/${other.slug}`}
									className="group rounded-xl border border-white/[0.1] bg-[#0b0b0f] p-2.5 transition-all hover:border-white/20"
								>
									<Cover view={other} className="aspect-[4/3] w-full" />
									<p className="mt-2.5 truncate text-[13px] font-medium text-white/88">{other.title}</p>
									<p className="tnum mt-0.5 truncate font-mono text-[11.5px] text-white/58">
										{other.year ?? "—"} - {other.publisher}
									</p>
								</Link>
							);
						})}
					</div>
				</section>
			)}
		</div>
	);
}
