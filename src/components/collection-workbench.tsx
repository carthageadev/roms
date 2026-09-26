import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MetalFx, useMetalBend, type MetalFxPreset } from "metal-fx";
import { Cover } from "./ui";
import {
	CURATOR_NOTE_MAX,
	LIST_PRESETS,
	deleteList,
	moveListItem,
	removeListItem,
	setCuratorNote,
	toggleListItem,
	updateList,
	type ListCollection,
} from "../lib/library-store";
import { useLibraryState } from "../lib/use-library";
import { formatSizeMb, romView, type RomView } from "../lib/rom-view";
import { useRomIndex } from "../lib/rom-index-context";
import { searchRoms } from "../lib/roms";
import { downloadJson } from "./library-rack";

export function CollectionWorkbench({ collection }: { collection: ListCollection }) {
	const { view } = useRomIndex();
	const { collections } = useLibraryState();
	const [editingMeta, setEditingMeta] = useState(false);
	const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
	const [pickerQuery, setPickerQuery] = useState("");
	const [copied, setCopied] = useState(false);

	const shareRef = useRef<HTMLButtonElement>(null);
	const exportRef = useRef<HTMLButtonElement>(null);
	useMetalBend(exportRef);
	useMetalBend(shareRef);

	// Always read the live store entry so cross-tab edits show up immediately.
	const current = collections.find((item) => item.id === collection.id) ?? collection;
	const preset = (LIST_PRESETS.includes(current.preset) ? current.preset : "chromatic") as MetalFxPreset;

	const items = useMemo(
		() =>
			current.items
				.map((item) => {
					const rom = view.byId.get(item.romId);
					return rom ? { item, rom, game: romView(rom) } : null;
				})
				.filter((row): row is NonNullable<typeof row> => row !== null),
		[current.items, view.byId],
	);

	const existingIds = new Set(current.items.map((item) => item.romId));

	const available = useMemo(() => {
		const text = pickerQuery.trim();
		const source = text
			? searchRoms(view.roms, text).hits.map((hit) => hit.rom)
			: view.roms.filter((_, index) => index % 97 === 0);
		return source
			.filter((rom) => !existingIds.has(rom.id))
			.slice(0, 14)
			.map(romView);
	}, [existingIds, pickerQuery, view.roms]);

	const handleExport = () => {
		downloadJson(
			{
				schema: "roms.tn/list-manifest/v1",
				id: current.id,
				title: current.name,
				curator: current.curator,
				note: current.note,
				preset: current.preset,
				createdAt: current.createdAt,
				spines: items.map((row, index) => ({
					spine: index + 1,
					id: row.game.id,
					title: row.game.title,
					platform: row.game.platform,
					publisher: row.game.publisher,
					year: row.game.year,
					size: row.game.size,
					folder: row.game.folder,
					url: row.game.url,
					curatorNote: row.item.curatorNote,
				})),
			},
			`romstn-list-${current.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`,
		);
	};

	return (
		<div>
			<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-white/[0.1] py-3.5">
				<div className="flex flex-wrap items-center gap-2">
					<MetalFx preset={preset} strength={1} theme="dark" innerShadow>
						<button
							ref={shareRef}
							type="button"
							onClick={() => {
								if (!navigator.clipboard) return;
								navigator.clipboard.writeText(window.location.href);
								setCopied(true);
								window.setTimeout(() => setCopied(false), 1800);
							}}
							className="inline-flex h-8 items-center gap-2 rounded-full bg-transparent px-4 text-[11.5px] font-medium text-white"
						>
							<span>{copied ? "✓ List link copied" : "Share list"}</span>
						</button>
					</MetalFx>

					<button
						ref={exportRef}
						type="button"
						onClick={handleExport}
						className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.02] px-3.5 font-mono text-[11.5px] uppercase tracking-[0.12em] text-white/70 transition-colors hover:border-white/25 hover:text-white"
					>
						↓ Export .JSON
					</button>

					<button
						type="button"
						onClick={() => setEditingMeta((value) => !value)}
						className="inline-flex h-8 items-center rounded-full border border-white/[0.12] px-3.5 text-[11.5px] text-white/76 transition-colors hover:border-white/25 hover:text-white"
					>
						{editingMeta ? "Close editor" : "Edit note & finish"}
					</button>
				</div>

				<button
					type="button"
					onClick={() => {
						if (window.confirm(`Delete “${current.name}”? This cannot be undone.`)) deleteList(current.id);
					}}
					className="h-8 rounded-full border border-white/[0.11] px-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/54 transition-colors hover:border-red-400/40 hover:text-red-300"
				>
					Delete list
				</button>
			</div>

			{editingMeta && (
				<form
					className="mt-5 rounded-2xl border border-white/[0.1] bg-[#0a0a0e] p-5"
					onSubmit={(event) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						updateList(current.id, {
							name: String(data.get("name") ?? ""),
							note: String(data.get("note") ?? ""),
							curator: String(data.get("curator") ?? ""),
							preset: String(data.get("preset") ?? "chromatic") as ListCollection["preset"],
						});
						setEditingMeta(false);
					}}
				>
					<div className="grid gap-3 sm:grid-cols-3">
						<div>
							<label htmlFor="edit-name" className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/58">
								Title
							</label>
							<input
								id="edit-name"
								name="name"
								required
								defaultValue={current.name}
								maxLength={80}
								className="mt-1 h-9 w-full rounded-lg border border-white/12 bg-black/50 px-3 text-[12.5px] text-white focus:border-white/30 focus:outline-none"
							/>
						</div>
						<div>
							<label htmlFor="edit-curator" className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/58">
								Curator
							</label>
							<input
								id="edit-curator"
								name="curator"
								defaultValue={current.curator}
								maxLength={60}
								className="mt-1 h-9 w-full rounded-lg border border-white/12 bg-black/50 px-3 text-[12.5px] text-white focus:border-white/30 focus:outline-none"
							/>
						</div>
						<div>
							<label htmlFor="edit-preset" className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/58">
								Finish
							</label>
							<select
								id="edit-preset"
								name="preset"
								defaultValue={current.preset}
								className="mt-1 h-9 w-full rounded-lg border border-white/12 bg-black/80 px-3 text-[12.5px] text-white focus:border-white/30 focus:outline-none"
							>
								<option value="chromatic">Chromatic</option>
								<option value="silver">Silver steel</option>
								<option value="gold">Warm gold</option>
							</select>
						</div>
					</div>
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<input
							name="note"
							defaultValue={current.note}
							maxLength={280}
							placeholder="Curatorial note…"
							className="h-9 flex-1 rounded-lg border border-white/12 bg-black/50 px-3 text-[12.5px] text-white placeholder:text-white/46 focus:border-white/30 focus:outline-none"
						/>
						<button type="submit" className="h-9 rounded-lg bg-white px-4 text-[12px] font-medium text-black">
							Save changes
						</button>
					</div>
				</form>
			)}

			<div className="mt-8 grid gap-10 lg:grid-cols-[1fr_350px]">
				<div>
					<div className="flex items-center justify-between">
						<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/56">
							Sequenced spines ({items.length})
						</p>
						<span className="hidden font-mono text-[11px] text-white/46 sm:block">CLICK NOTE TO ANNOTATE - ↑↓ TO SEQUENCE</span>
					</div>

					{items.length === 0 ? (
						<div className="mt-4 rounded-2xl border border-dashed border-white/12 py-16 text-center">
							<p className="text-[14px] text-white/60">No records filed on this list yet.</p>
							<p className="mt-1.5 text-[12.5px] text-white/58">
								Use the append panel on the right, or add from any game page.
							</p>
						</div>
					) : (
						<div className="mt-4 space-y-3">
							{items.map(({ game, item }, index) => {
								const isEditing = editingNoteId === game.id;
								return (
									<div
										key={game.id}
										className="group rounded-2xl border border-white/[0.1] bg-[#0b0b0f] p-4 transition-colors hover:border-white/[0.18]"
									>
										<div className="flex items-start gap-4">
											<div className="flex flex-col items-center gap-1 pt-0.5">
												<span className="tnum rounded border border-white/12 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] font-medium text-white/70">
													#{String(index + 1).padStart(2, "0")}
												</span>
												<div className="mt-1 flex flex-col gap-0.5">
													<button
														type="button"
														disabled={index === 0}
														onClick={() => moveListItem(current.id, game.id, "up")}
														title="Move spine up"
														className="flex h-5 w-6 items-center justify-center rounded border border-white/[0.1] font-mono text-[11px] text-white/58 hover:border-white/25 hover:text-white disabled:opacity-20"
													>
														↑
													</button>
													<button
														type="button"
														disabled={index === items.length - 1}
														onClick={() => moveListItem(current.id, game.id, "down")}
														title="Move spine down"
														className="flex h-5 w-6 items-center justify-center rounded border border-white/[0.1] font-mono text-[11px] text-white/58 hover:border-white/25 hover:text-white disabled:opacity-20"
													>
														↓
													</button>
												</div>
											</div>

											<Link to={`/rom/${game.slug}`} className="block w-24 shrink-0 sm:w-28">
												<Cover view={game} className="aspect-[4/3] w-full" compact />
											</Link>

											<div className="min-w-0 flex-1">
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0">
														<Link
															to={`/rom/${game.slug}`}
															className="block truncate text-[15px] font-medium tracking-[-0.015em] text-white/92 hover:text-white"
														>
															{game.title}
														</Link>
														<p className="mt-0.5 truncate font-mono text-[11.5px] uppercase tracking-[0.12em] text-white/58">
															{game.platform} - {game.year ?? "—"} - {game.publisher} - {formatSizeMb(game.sizeMb)}
														</p>
													</div>
													<button
														type="button"
														onClick={() => removeListItem(current.id, game.id)}
														title="Remove from list"
														aria-label="Remove from list"
														className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.11] text-[11px] text-white/52 hover:border-red-300/40 hover:text-red-300"
													>
														×
													</button>
												</div>

												<div className="mt-3 border-t border-white/[0.12] pt-2.5">
													{isEditing ? (
														<form
															onSubmit={(event) => {
																event.preventDefault();
																const data = new FormData(event.currentTarget);
																setCuratorNote(current.id, game.id, String(data.get("curatorNote") ?? ""));
																setEditingNoteId(null);
															}}
															className="flex items-center gap-1.5"
														>
															<input
																name="curatorNote"
																defaultValue={item.curatorNote}
																autoFocus
																maxLength={CURATOR_NOTE_MAX}
																placeholder="Why does this record belong on this list?…"
																className="h-8 flex-1 rounded border border-white/15 bg-black/60 px-2.5 text-[12px] text-white placeholder:text-white/46 focus:outline-none"
															/>
															<button
																type="submit"
																className="h-8 rounded bg-white px-3 font-mono text-[11px] font-medium text-black"
															>
																Save
															</button>
															<button
																type="button"
																onClick={() => setEditingNoteId(null)}
																className="h-8 rounded border border-white/10 px-2 font-mono text-[11px] text-white/62"
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
															<p className="text-[12.5px] leading-relaxed text-white/76 group-hover/note:text-white/80">
																{item.curatorNote ? (
																	<>
																		<span className="mr-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/48">
																			LINER NOTE //
																		</span>
																		“{item.curatorNote}”
																	</>
																) : (
																	<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/44 group-hover/note:text-white/72">
																		+ Add a liner note for spine #{String(index + 1).padStart(2, "0")}…
																	</span>
																)}
															</p>
															<span className="shrink-0 font-mono text-[11px] text-white/46 opacity-0 transition-opacity group-hover/note:opacity-100">
																ANNOTATE
															</span>
														</button>
													)}
												</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				<aside className="lg:sticky lg:top-20 lg:self-start">
					<div className="panel rounded-2xl p-5">
						<div className="flex items-center justify-between">
							<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">Append a record</p>
							<span className="tnum font-mono text-[11px] text-white/52">
								NEXT: #{String(items.length + 1).padStart(2, "0")}
							</span>
						</div>
						<div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/55 px-3 py-2">
							<span className="font-mono text-[11px] text-white/52" aria-hidden>
								⌕
							</span>
							<input
								value={pickerQuery}
								onChange={(event) => setPickerQuery(event.target.value)}
								placeholder="Search the index to add a spine…"
								aria-label="Search the index to add a spine"
								className="flex-1 bg-transparent text-[12.5px] text-white placeholder:text-white/46 focus:outline-none"
							/>
						</div>
						<div className="mt-3 max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
							{available.length === 0 && (
								<p className="py-6 text-center text-[12.5px] text-white/55">
									{view.roms.length === 0 ? "Loading the shared index…" : "Nothing left to add from this view."}
								</p>
							)}
							{available.map((game) => (
								<PickerRow key={game.id} game={game} listId={current.id} />
							))}
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}

function PickerRow({ game, listId }: { game: RomView; listId: string }) {
	return (
		<div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.1] bg-black/40 p-2 transition-colors hover:border-white/20">
			<div className="flex min-w-0 items-center gap-2.5">
				<Cover view={game} className="h-9 w-11 shrink-0" compact />
				<div className="min-w-0">
					<Link to={`/rom/${game.slug}`} className="block truncate text-[12px] font-medium text-white/88 hover:text-white">
						{game.title}
					</Link>
					<p className="truncate font-mono text-[11px] text-white/54">
						{game.platform} - {game.year ?? "—"}
					</p>
				</div>
			</div>
			<button
				type="button"
				onClick={() => toggleListItem(listId, game.id)}
				className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 font-mono text-[11px] text-white/75 transition-colors hover:bg-white hover:text-black"
			>
				<span>+</span>
				<span>Add</span>
			</button>
		</div>
	);
}
