import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MetalFx, useMetalBend } from "metal-fx";
import { Cover, STATUS_META } from "../components/ui";
import {
	STATUS_KEYS,
	createList,
	setStatus,
	setPinned,
	setNotes,
	toggleListItem,
	toggleSave,
	type LibraryStatus,
} from "../lib/library-store";
import { useLibraryState } from "../lib/use-library";
import { formatSizeMb as formatMb, romView, type RomView } from "../lib/rom-view";
import { useRomIndex } from "../lib/rom-index-context";
import type { RomEntry } from "../lib/roms";

const TABS = [
	{ key: "all", label: "Everything" },
	{ key: "now", label: "In rotation" },
	{ key: "finished", label: "Finished" },
	{ key: "pinned", label: "Pinned" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function LibraryRack() {
	const { view } = useRomIndex();
	const { saves, collections } = useLibraryState();
	const [filter, setFilter] = useState<TabKey>("all");
	const [listView, setListView] = useState<"rack" | "ledger">("rack");
	const [search, setSearch] = useState("");
	const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
	const [mintOpen, setMintOpen] = useState(false);
	const navigate = useNavigate();

	const exportRef = useRef<HTMLButtonElement>(null);
	const mintRef = useRef<HTMLButtonElement>(null);
	useMetalBend(exportRef);
	useMetalBend(mintRef);

	/** Saved ids resolved against the real index; unknown ids are dropped. */
	const rows = useMemo(() => {
		const entries = Object.entries(saves);
		const resolved: Array<{ rom: RomEntry; game: RomView; entry: (typeof saves)[string] }> = [];
		for (const [id, entry] of entries) {
			const rom = view.byId.get(id);
			if (rom) resolved.push({ rom, game: romView(rom), entry });
		}
		return resolved.sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
	}, [saves, view.byId]);

	const filtered = useMemo(() => {
		const needle = search.trim().toLowerCase();
		return rows.filter(({ game, entry }) => {
			if (filter === "pinned" && !entry.pinned) return false;
			if (filter === "finished" && entry.status !== "completed" && entry.status !== "mastered") return false;
			if (filter === "now" && entry.status !== "playing") return false;
			if (!needle) return true;
			return (
				game.title.toLowerCase().includes(needle) ||
				game.platform.toLowerCase().includes(needle) ||
				game.publisher.toLowerCase().includes(needle) ||
				entry.notes.toLowerCase().includes(needle)
			);
		});
	}, [filter, rows, search]);

	const counts = useMemo(
		() => ({
			all: rows.length,
			now: rows.filter((row) => row.entry.status === "playing").length,
			finished: rows.filter((row) => row.entry.status === "completed" || row.entry.status === "mastered").length,
			pinned: rows.filter((row) => row.entry.pinned).length,
		}),
		[rows],
	);

	const totalMb = rows.reduce((total, row) => total + (row.game.sizeMb ?? 0), 0);

	const handleExport = () => {
		const payload = {
			schema: "roms.tn/library-manifest/v1",
			exportedAt: new Date().toISOString(),
			totalRecords: rows.length,
			totalSizeMb: Number(totalMb.toFixed(2)),
			entries: rows.map(({ game, entry }) => ({
				id: game.id,
				title: game.title,
				platform: game.platform,
				publisher: game.publisher,
				year: game.year,
				size: game.size,
				folder: game.folder,
				url: game.url,
				status: entry.status,
				pinned: entry.pinned,
				notes: entry.notes,
				savedAt: entry.createdAt,
			})),
		};
		downloadJson(payload, `romstn-library-${new Date().toISOString().slice(0, 10)}.json`);
	};

	return (
		<div className="mt-8">
			<div className="flex flex-col gap-4 border-y border-white/[0.14] py-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
					{TABS.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setFilter(tab.key)}
							className={`border-b pb-1 text-[12px] transition-colors ${
								filter === tab.key ? "border-white text-white" : "border-transparent text-white/58 hover:text-white"
							}`}
						>
							{tab.label} <span className="ml-1 font-mono text-[10px] text-white/55">{counts[tab.key]}</span>
						</button>
					))}
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Find in your library"
						aria-label="Find in your library"
						className="h-8 w-40 border-b border-white/[0.18] bg-transparent text-[12px] text-white placeholder:text-white/40 focus:border-white focus:outline-none"
					/>
					<button
						type="button"
						onClick={() => setListView(listView === "rack" ? "ledger" : "rack")}
						className="text-[12px] text-white/68 hover:text-white"
					>
						{listView === "rack" ? "Simple list" : "Cover view"}
					</button>
					<button
						ref={exportRef}
						type="button"
						onClick={handleExport}
						className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/58 hover:text-white"
					>
						Export
					</button>
					<MetalFx preset="chromatic" strength={0.9} theme="dark" innerShadow>
						<button
							ref={mintRef}
							type="button"
							onClick={() => setMintOpen(true)}
							className="inline-flex h-8 items-center rounded-full bg-transparent px-3.5 text-[11px] font-medium text-white"
						>
							Make a list
						</button>
					</MetalFx>
				</div>
			</div>

			{filtered.length === 0 ? (
				<div className="mt-8 rounded-2xl border border-dashed border-white/10 py-16 text-center">
					<p className="text-[13.5px] text-white/76">No records match the current filter.</p>
					<button
						type="button"
						onClick={() => {
							setFilter("all");
							setSearch("");
						}}
						className="mt-4 inline-flex h-8 items-center rounded-full border border-white/15 px-4 text-[11.5px] text-white/70 hover:border-white/35 hover:text-white"
					>
						Clear filter
					</button>
				</div>
			) : listView === "rack" ? (
				<div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map(({ game, entry }) => {
						const status = entry.status;
						const isEditingNote = editingNoteId === game.id;
						return (
							<div
								key={game.id}
								className="group flex flex-col justify-between rounded-xl border border-white/[0.1] bg-[#0b0b0f] p-3.5 transition-all hover:border-white/[0.18]"
							>
								<div>
									<div className="flex items-start gap-3.5">
										<Link to={`/rom/${game.slug}`} className="block w-24 shrink-0">
											<Cover view={game} className="aspect-[4/3] w-full" compact />
										</Link>
										<div className="min-w-0 flex-1">
											<div className="flex items-start justify-between gap-2">
												<Link
													to={`/rom/${game.slug}`}
													className="truncate text-[14px] font-medium tracking-[-0.01em] text-white/92 hover:text-white"
												>
													{game.title}
												</Link>
												<button
													type="button"
													onClick={() => setPinned(game.id, !entry.pinned)}
													title={entry.pinned ? "Unpin from top" : "Pin to top of rack"}
													aria-label={entry.pinned ? "Unpin" : "Pin"}
													className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors ${
														entry.pinned
															? "border-amber-300/40 bg-amber-300/15 text-amber-200"
															: "border-white/[0.1] text-white/46 hover:border-white/25 hover:text-white/70"
													}`}
												>
													★
												</button>
											</div>
											<p className="mt-0.5 truncate font-mono text-[11.5px] uppercase tracking-[0.12em] text-white/58">
												{game.platform} - {game.year ?? "-"} - {formatMb(game.sizeMb)}
											</p>
											<div className="mt-2.5 flex flex-wrap gap-1">
												{STATUS_KEYS.map((key) => {
													const meta = STATUS_META[key];
													const active = status === key;
													return (
														<button
															key={key}
															type="button"
															onClick={() => setStatus(game.id, key)}
															className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all ${
																active
																	? meta.badge
																	: "border-white/[0.1] text-white/52 hover:border-white/20 hover:text-white/65"
															}`}
														>
															{active && <span className={`h-1 w-1 rounded-full ${meta.dot}`} />}
															{meta.short}
														</button>
													);
												})}
											</div>
										</div>
									</div>

									<div className="mt-3 border-t border-white/[0.12] pt-2.5">
										{isEditingNote ? (
											<form
												onSubmit={(event) => {
													event.preventDefault();
													const data = new FormData(event.currentTarget);
													setNotes(game.id, String(data.get("notes") ?? ""));
													setEditingNoteId(null);
												}}
												className="flex items-center gap-1.5"
											>
												<input
													name="notes"
													defaultValue={entry.notes}
													autoFocus
													maxLength={400}
													placeholder="Personal log note (revision, clear time)…"
													className="h-7 flex-1 rounded border border-white/15 bg-black/60 px-2.5 text-[11.5px] text-white placeholder:text-white/46 focus:outline-none"
												/>
												<button
													type="submit"
													className="h-7 rounded bg-white px-2.5 font-mono text-[11px] font-medium text-black"
												>
													Save
												</button>
												<button
													type="button"
													onClick={() => setEditingNoteId(null)}
													className="h-7 rounded border border-white/10 px-2 font-mono text-[11px] text-white/62"
												>
													×
												</button>
											</form>
										) : (
											<button
												type="button"
												onClick={() => setEditingNoteId(game.id)}
												className="group/note flex w-full items-start justify-between gap-2 text-left"
											>
												<p className="line-clamp-2 text-[11.5px] leading-relaxed text-white/66 group-hover/note:text-white/70">
													{entry.notes ? (
														<>
															<span className="mr-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/46">
																LOG //
															</span>
															{entry.notes}
														</>
													) : (
														<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/42 group-hover/note:text-white/68">
															+ Add log note…
														</span>
													)}
												</p>
												<span className="shrink-0 font-mono text-[11px] text-white/20 opacity-0 transition-opacity group-hover/note:opacity-100">
													EDIT
												</span>
											</button>
										)}
									</div>
								</div>

								<div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.12] pt-2.5">
									<div className="flex flex-wrap items-center gap-1">
										{collections.length === 0 ? (
											<Link to="/collections" className="font-mono text-[11px] text-white/52 hover:text-white/70">
												+ Create a list to file
											</Link>
										) : (
											collections.slice(0, 3).map((list) => {
												const inList = list.items.some((item) => item.romId === game.id);
												return (
													<button
														key={list.id}
														type="button"
														onClick={() => toggleListItem(list.id, game.id)}
														title={inList ? `Remove from ${list.name}` : `Add to ${list.name}`}
														className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors ${
															inList
																? "border-white/50 bg-white/90 font-medium text-black"
																: "border-white/[0.1] text-white/60 hover:border-white/25 hover:text-white"
														}`}
													>
														<span>{inList ? "✓" : "+"}</span>
														<span className="max-w-[90px] truncate">{list.name}</span>
													</button>
												);
											})
										)}
									</div>
									<button
										type="button"
										onClick={() => toggleSave(game.id)}
										title="Remove from library"
										className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/46 transition-colors hover:text-red-300/80"
									>
										Eject
									</button>
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0b0b0f]">
					<div className="grid grid-cols-[1fr_100px_90px_130px_40px] items-center border-b border-white/[0.1] bg-white/[0.02] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/54">
						<span>Record / Note</span>
						<span className="hidden sm:block">System</span>
						<span className="hidden text-right md:block">Footprint</span>
						<span>Status</span>
						<span className="text-right">Pin</span>
					</div>
					<div className="divide-y divide-white/[0.08]">
						{filtered.map(({ game, entry }) => {
							const meta = STATUS_META[entry.status] ?? STATUS_META.saved;
							const nextStatus = STATUS_KEYS[(STATUS_KEYS.indexOf(entry.status) + 1) % STATUS_KEYS.length] as LibraryStatus;
							return (
								<div
									key={game.id}
									className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:grid-cols-[1fr_100px_90px_130px_40px]"
								>
									<div className="min-w-0">
										<div className="flex items-center gap-2.5">
											<span
												className="h-2 w-2 shrink-0 rounded-full"
												style={{ background: `hsl(${game.hue} 65% 52%)` }}
											/>
											<Link
												to={`/rom/${game.slug}`}
												className="truncate text-[13px] font-medium text-white/90 hover:text-white"
											>
												{game.title}
											</Link>
											<span className="font-mono text-[11.5px] text-white/48">{game.year ?? "-"}</span>
										</div>
										{entry.notes && <p className="mt-0.5 truncate pl-[18px] text-[11px] text-white/58">{entry.notes}</p>}
									</div>
									<span className="hidden truncate font-mono text-[11px] text-white/68 sm:block">{game.platform}</span>
									<span className="tnum hidden text-right font-mono text-[11px] text-white/60 md:block">
										{formatMb(game.sizeMb)}
									</span>
									<button
										type="button"
										onClick={() => setStatus(game.id, nextStatus)}
										title="Click to cycle status"
										className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] ${meta.badge}`}
									>
										<span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
										{meta.short}
									</button>
									<div className="flex justify-end">
										<button
											type="button"
											onClick={() => setPinned(game.id, !entry.pinned)}
											aria-label={entry.pinned ? "Unpin" : "Pin"}
											className={`text-[12px] ${entry.pinned ? "text-amber-300" : "text-white/20 hover:text-white/60"}`}
										>
											★
										</button>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{mintOpen && (
				<MintListDialog
					count={filtered.length}
					romIds={filtered.map((row) => row.game.id)}
					defaultName={filter === "now" ? "Current rotation" : filter === "finished" ? "Finished canon" : "Personal preservation rack"}
					onClose={() => setMintOpen(false)}
					onCreated={(id) => {
						setMintOpen(false);
						navigate(`/collections/${id}`);
					}}
				/>
			)}
		</div>
	);
}

function MintListDialog({
	count,
	romIds,
	defaultName,
	onClose,
	onCreated,
}: {
	count: number;
	romIds: string[];
	defaultName: string;
	onClose: () => void;
	onCreated: (id: string) => void;
}) {
	return (
		<div className="dialog-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={onClose}>
			<div className="w-full max-w-[460px] rounded-2xl border border-white/[0.12] bg-[#0a0a0e] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
				<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/58">Library → List</p>
				<h3 className="mt-2 text-[20px] font-semibold tracking-[-0.025em] text-strong">
					Mint a list from {count} {count === 1 ? "record" : "records"}
				</h3>
				<p className="mt-1.5 text-[12.5px] text-white/66">
					Packages your currently filtered library view into a permanent, ordered list.
				</p>
				<form
					className="mt-5 space-y-3.5"
					onSubmit={(event) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						const id = createList({
							name: String(data.get("name") ?? ""),
							note: String(data.get("note") ?? ""),
							curator: String(data.get("curator") ?? ""),
							preset: String(data.get("preset") ?? "chromatic") as "chromatic" | "silver" | "gold",
							romIds,
						});
						onCreated(id);
					}}
				>
					<div>
						<label htmlFor="mint-name" className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/58">
							List title
						</label>
						<input
							id="mint-name"
							name="name"
							required
							maxLength={80}
							defaultValue={defaultName}
							className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-black/50 px-3 text-[13px] text-white focus:border-white/30 focus:outline-none"
						/>
					</div>
					<div className="grid grid-cols-2 gap-2.5">
						<div>
							<label htmlFor="mint-curator" className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/58">
								Curator
							</label>
							<input
								id="mint-curator"
								name="curator"
								maxLength={60}
								placeholder="You"
								className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-black/50 px-3 text-[13px] text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
							/>
						</div>
						<div>
							<label htmlFor="mint-preset" className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/58">
								Finish
							</label>
							<select
								id="mint-preset"
								name="preset"
								defaultValue="chromatic"
								className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-black/80 px-3 text-[13px] text-white focus:border-white/30 focus:outline-none"
							>
								<option value="chromatic">Chromatic</option>
								<option value="silver">Silver steel</option>
								<option value="gold">Warm gold</option>
							</select>
						</div>
					</div>
					<div>
						<label htmlFor="mint-note" className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/58">
							Curatorial note
						</label>
						<input
							id="mint-note"
							name="note"
							maxLength={280}
							placeholder="Optional liner notes for this list…"
							className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-black/50 px-3 text-[13px] text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
						/>
					</div>
					<div className="flex items-center justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="h-9 rounded-full border border-white/10 px-4 text-[12px] text-white/72 hover:text-white"
						>
							Cancel
						</button>
						<button type="submit" className="h-9 rounded-full bg-white px-5 text-[12px] font-medium text-black hover:opacity-90">
							Create &amp; open →
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export function downloadJson(payload: unknown, filename: string): void {
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
