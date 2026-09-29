/**
 * The landing shelf.
 *
 * Ported from the arena.ai build: one screen holds the hero, the searchable
 * index, and a persistent shelf of what you kept and the lists you made. The
 * server actions and Postgres from that build are replaced by the real shared
 * index (`lib/roms`) and the localStorage store (`lib/library-store`), so the
 * data on screen is always the live host catalogue.
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MetalButton, MetalMark, scrollToId } from "../components/metal";
import HeroCartridgesFallback from "../components/HeroCartridgesFallback";
import type { HeroCartridge } from "../components/HeroCartridges";
import { resolveHeroArt } from "../lib/cover-art";
import { resolveHero } from "../lib/hero";

const HeroCartridges = lazy(() => import("../components/HeroCartridges"));
import { ShelfCover } from "../components/ui";
import { CANON_TEMPLATES, resolveCanon, type ResolvedCanonItem } from "../lib/canon";
import {
	createList,
	deleteList,
	moveListItem,
	toggleListItem,
	toggleSave,
	NAME_MAX,
} from "../lib/library-store";
import { DATA_SOURCE_HOST, useRomIndex } from "../lib/rom-index-context";
import { formatSizeMb, romView, type RomView } from "../lib/rom-view";
import { searchRoms } from "../lib/roms";
import { useLibraryState } from "../lib/use-library";

const SORTS = [
	{ key: "index", label: "Index order" },
	{ key: "az", label: "A - Z" },
	{ key: "za", label: "Z - A" },
	{ key: "year", label: "Newest" },
	{ key: "size", label: "Largest" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const PAGE = 60;

interface ShelfList {
	id: string;
	name: string;
	note: string;
	curator: string;
	items: Array<{ romId: string; curatorNote: string }>;
}

export default function Landing() {
	const { view, total, loading, error, status, sourceLabel } = useRomIndex();
	const { saves, collections } = useLibraryState();

	const [query, setQuery] = useState("");
	const [deferred, setDeferred] = useState("");
	const [system, setSystem] = useState("all");
	const [sort, setSort] = useState<SortKey>("index");
	const [openId, setOpenId] = useState<string | null>(null);
	const [tab, setTab] = useState<"library" | "lists">("library");
	const [openList, setOpenList] = useState<string | null>(null);
	const [sheet, setSheet] = useState(false);
	const [listName, setListName] = useState("");
	const [visible, setVisible] = useState(PAGE);
	const searchRef = useRef<HTMLInputElement>(null);

	// Debounce: the shared index is large, so never search on every keystroke.
	useEffect(() => {
		const timer = window.setTimeout(() => setDeferred(query), 130);
		return () => window.clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpenId(null);
				setSheet(false);
			}
			if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
				event.preventDefault();
				searchRef.current?.focus();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const consoles = useMemo(() => {
		const counts = new Map<string, number>();
		for (const rom of view.roms) counts.set(rom.console || "Unknown", (counts.get(rom.console || "Unknown") ?? 0) + 1);
		return [...counts.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	}, [view.roms]);

	const matches = useMemo(() => {
		const needle = deferred.trim();
		if (!needle) return view.roms;
		return searchRoms(view.roms, needle).hits.map((hit) => hit.rom);
	}, [deferred, view.roms]);

	const results = useMemo(() => {
		if (system === "all") return matches;
		return matches.filter((rom) => (rom.console || "Unknown") === system);
	}, [matches, system]);

	const sorted = useMemo(() => {
		if (sort === "index") return results;
		const copy = [...results];
		if (sort === "az") copy.sort((a, b) => a.title.localeCompare(b.title));
		else if (sort === "za") copy.sort((a, b) => b.title.localeCompare(a.title));
		else if (sort === "year") {
			copy.sort(
				(a, b) =>
					(Number(b.date?.slice(0, 4) || 0) - Number(a.date?.slice(0, 4) || 0)) || a.title.localeCompare(b.title),
			);
		} else {
			copy.sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0) || a.title.localeCompare(b.title));
		}
		return copy;
	}, [results, sort]);

	const shown = sorted.slice(0, visible);
	const searching = deferred.trim().length > 0;

	const savedIds = useMemo(() => new Set(Object.keys(saves)), [saves]);

	const library = useMemo(() => {
		const rows = Object.entries(saves)
			.map(([id, entry]) => {
				const rom = view.byId.get(id);
				return rom ? { game: romView(rom), entry } : null;
			})
			.filter((row): row is { game: RomView; entry: (typeof saves)[string] } => row !== null);
		rows.sort((a, b) => Number(b.entry.pinned) - Number(a.entry.pinned) || b.entry.createdAt.localeCompare(a.entry.createdAt));
		return rows;
	}, [saves, view.byId]);

	const lists: ShelfList[] = useMemo(
		() =>
			collections.map((collection) => ({
				id: collection.id,
				name: collection.name,
				note: collection.note,
				curator: collection.curator,
				items: collection.items.map((item) => ({ romId: item.romId, curatorNote: item.curatorNote })),
			})),
		[collections],
	);

	const inListsFor = useCallback(
		(romId: string) => lists.filter((list) => list.items.some((item) => item.romId === romId)),
		[lists],
	);

	// Hero cartridges: popular records bound to the live index, with optional
	// real box art that resolves once and only for this list.
	const heroResolved = useMemo(() => resolveHero(view.roms), [view.roms]);
	const [heroArt, setHeroArt] = useState<Map<string, string | null>>(new Map());

	useEffect(() => {
		let cancelled = false;
		resolveHeroArt(heroResolved.map((item) => item.rom.title)).then((art) => {
			if (!cancelled) setHeroArt(art);
		});
		return () => {
			cancelled = true;
		};
	}, [heroResolved]);

	const heroItems: HeroCartridge[] = useMemo(
		() => heroResolved.map((item) => ({ rom: item.rom, artUrl: heroArt.get(item.rom.title) ?? null })),
		[heroResolved, heroArt],
	);

	const canons = useMemo(
		() => CANON_TEMPLATES.map((template) => ({ template, resolved: resolveCanon(view.roms, template) })),
		[view.roms],
	);

	const stats = useMemo(() => {
		let bytes = 0;
		for (const rom of view.roms) bytes += rom.sizeBytes ?? 0;
		return { titles: total, systems: consoles.length, bytes };
	}, [consoles.length, total, view.roms]);

	const makeList = useCallback((name: string) => {
		const clean = name.trim().slice(0, NAME_MAX);
		if (!clean) return null;
		return createList({ name: clean, curator: "You" });
	}, []);

	const cloneCanon = useCallback(
		(templateKey: string) => {
			const entry = canons.find((item) => item.template.key === templateKey);
			if (!entry) return;
			const resolved: ResolvedCanonItem[] = entry.resolved;
			const id = createList({
				name: entry.template.name,
				note: entry.template.note,
				curator: entry.template.curator,
				preset: entry.template.preset,
			});
			for (const item of resolved) toggleListItem(id, item.rom.id);
			setOpenList(id);
			setTab("lists");
			setListName("");
		},
		[canons],
	);

	const shelfPanel = (
		<div className="flex h-full flex-col">
			<div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
				<button
					type="button"
					onClick={() => setTab("library")}
					className={`tab ${tab === "library" ? "on" : ""}`}
				>
					Library <span className="tnum faint ml-1">{library.length}</span>
				</button>
				<button type="button" onClick={() => setTab("lists")} className={`tab ${tab === "lists" ? "on" : ""}`}>
					Lists <span className="tnum faint ml-1">{lists.length}</span>
				</button>
			</div>

			<div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 no-scrollbar">
				{tab === "library" ? (
					library.length === 0 ? (
						<div className="sheet-card px-5 py-10 text-center">
							<p className="text-[14px]">Your shelf is empty.</p>
							<p className="muted mt-1.5 text-[12.5px]">
								Press <span className="text-white">Keep</span> on anything in the index.
							</p>
						</div>
					) : (
						<ul className="space-y-1">
							{library.map((row) => (
								<li
									key={row.game.id}
									className="in flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.04]"
								>
									<ShelfCover view={row.game} compact className="h-10 w-12 shrink-0" />
									<Link
										to={`/rom/${row.game.slug}`}
										className="min-w-0 flex-1 text-left"
										onClick={() => setSheet(false)}
									>
										<span className="block truncate text-[13.5px]">{row.game.title}</span>
										<span className="faint block text-[11.5px]">
											{row.game.platform} - {row.game.year ?? "-"}
										</span>
									</Link>
									<button
										type="button"
										onClick={() => toggleSave(row.game.id)}
										aria-label={`Remove ${row.game.title}`}
										className="faint shrink-0 px-1.5 text-[15px] hover:text-white"
									>
										×
									</button>
								</li>
							))}
						</ul>
					)
				) : (
					<div>
						<form
							className="underline-field flex items-center gap-2 pb-2"
							onSubmit={(event) => {
								event.preventDefault();
								if (makeList(listName)) setListName("");
							}}
						>
							<input
								value={listName}
								onChange={(event) => setListName(event.target.value)}
								maxLength={NAME_MAX}
								placeholder="Name a list..."
								aria-label="Name a list"
								className="bare py-1.5 text-[14px]"
							/>
							<button
								type="submit"
								disabled={!listName.trim()}
								className="shrink-0 text-[13px] text-white/70 hover:text-white disabled:opacity-30"
							>
								Create
							</button>
						</form>

						{lists.length > 0 && (
							<ul className="mt-4 space-y-1">
								{lists.map((list) => {
									const open = openList === list.id;
									const ordered = list.items
										.map((item) => view.byId.get(item.romId))
										.filter((rom): rom is NonNullable<typeof rom> => Boolean(rom))
										.map(romView);
									const totalMb = ordered.reduce((sum, game) => sum + (game.sizeMb ?? 0), 0);
									return (
										<li key={list.id} className="rounded-xl">
											<button
												type="button"
												onClick={() => setOpenList(open ? null : list.id)}
												className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/[0.04]"
												aria-expanded={open}
											>
												<span className="flex -space-x-2">
													{ordered.slice(0, 3).map((game) => (
														<ShelfCover
															key={game.id}
															view={game}
															compact
															className="h-8 w-8 ring-2 ring-[#0a0a0b]"
														/>
													))}
													{ordered.length === 0 && (
														<span className="faint grid h-8 w-8 place-items-center rounded-xl border border-dashed border-white/20 text-[12px]">
															+
														</span>
													)}
												</span>
												<span className="min-w-0 flex-1 truncate text-[13.5px]">{list.name}</span>
												<span className="tnum faint text-[12px]">{ordered.length}</span>
											</button>

											{open && (
												<div className="in pb-3 pl-2">
													{list.note && <p className="faint px-1 pb-2 text-[11.5px] leading-relaxed">{list.note}</p>}
													<p className="faint tnum px-1 pb-2 text-[11px]">
														{formatSizeMb(totalMb)}
														{list.curator ? ` - curated by ${list.curator}` : ""}
													</p>
													{ordered.length === 0 ? (
														<p className="faint px-1 py-2 text-[12px]">
															Empty - press + on a record to file it here.
														</p>
													) : (
														<ol className="space-y-0.5">
															{ordered.map((game, index) => (
																<li
																	key={game.id}
																	className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/[0.03]"
																>
																	<span className="tnum faint w-5 text-[11px]">{index + 1}</span>
																	<Link
																		to={`/rom/${game.slug}`}
																		className="min-w-0 flex-1 truncate text-[12.5px] hover:underline"
																	onClick={() => setSheet(false)}
																	>
																		{game.title}
																	</Link>
																	<button
																		type="button"
																		disabled={index === 0}
																		onClick={() => moveListItem(list.id, game.id, "up")}
																		aria-label="Move up"
																		className="faint px-1 hover:text-white disabled:opacity-20"
																	>
																		↑
																	</button>
																	<button
																		type="button"
																		disabled={index === ordered.length - 1}
																		onClick={() => moveListItem(list.id, game.id, "down")}
																		aria-label="Move down"
																		className="faint px-1 hover:text-white disabled:opacity-20"
																	>
																		↓
																	</button>
																	<button
																		type="button"
																		onClick={() => toggleListItem(list.id, game.id)}
																		aria-label={`Remove ${game.title}`}
																		className="faint px-1 hover:text-white"
																	>
																		×
																	</button>
																</li>
															))}
														</ol>
													)}
													<Link
														to={`/collections/${list.id}`}
														className="faint mt-2 inline-block px-1 text-[11.5px] hover:text-white"
														onClick={() => setSheet(false)}
													>
														Open workbench →
													</Link>
													<button
														type="button"
														onClick={() => deleteList(list.id)}
														className="faint mt-2 ml-3 px-1 text-[11.5px] hover:text-white"
													>
														Delete list
													</button>
												</div>
											)}
										</li>
									);
								})}
							</ul>
						)}

						<p className="faint mt-7 mb-3 font-mono text-[10.5px] tracking-[0.2em] uppercase">
							Or clone a canon
						</p>
						<div className="space-y-2">
							{canons.map(({ template, resolved }) => (
								<div key={template.key} className="sheet-card p-3.5">
									<div className="flex items-baseline justify-between gap-3">
										<p className="text-[13px] font-medium tracking-[-0.02em]">{template.name}</p>
										<span className="faint tnum font-mono text-[10px]">{template.code}</span>
									</div>
									<p className="muted mt-1 line-clamp-2 text-[11.5px] leading-relaxed">{template.note}</p>
									<div className="mt-3 flex items-center justify-between">
										<span className="flex -space-x-2">
											{resolved.slice(0, 4).map((item) => (
												<ShelfCover
													key={item.rom.id}
													view={romView(item.rom)}
													compact
													className="h-7 w-7 ring-2 ring-[#0a0a0b]"
												/>
											))}
										</span>
										<button type="button" onClick={() => cloneCanon(template.key)} className="ghost h-8 px-3.5 text-[12px]">
											Clone
										</button>
									</div>
									{resolved.length < template.intents.length && (
										<p className="faint mt-2 text-[10.5px]">
											{template.intents.length - resolved.length} entries not in the shared index yet.
										</p>
									)}
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);

	return (
		<div id="top">
			{/* HERO */}
			<header className="relative">
				<div
					className="orb"
					aria-hidden
					style={{
						width: 520,
						height: 520,
						top: "-12%",
						left: "52%",
						background:
							"conic-gradient(from 210deg, rgba(175,190,220,.18), transparent 44%, rgba(220,195,165,.12), transparent 74%)",
					}}
				/>
				<div className="wrap relative grid min-h-[92svh] items-center gap-8 py-12 lg:grid-cols-[1fr_1fr] lg:gap-10 lg:py-8">
					<div>
						<p className="rise faint font-mono text-[11px] tracking-[0.3em] uppercase">roms.tn</p>
						<h1
							className="rise mt-6 text-[clamp(3.2rem,9vw,7rem)] leading-[0.86] font-semibold tracking-[-0.07em]"
							style={{ animationDelay: "60ms" }}
						>
							<span className="chrome">Every cartridge,</span>
							<br />
							<span className="muted">one page.</span>
						</h1>
						<p className="rise muted mt-8 max-w-[44ch] text-[15.5px] leading-relaxed" style={{ animationDelay: "120ms" }}>
							Search the index, keep what matters, and build lists, all without ever leaving this screen.
						</p>
						<div className="rise mt-10 flex flex-wrap items-center gap-4" style={{ animationDelay: "180ms" }}>
							<MetalButton onClick={() => scrollToId("index")}>Open the index</MetalButton>
							<button
								type="button"
								onClick={() => {
									setTab("lists");
									scrollToId("index");
								}}
								className="text-[14px] text-white/60 underline decoration-white/25 underline-offset-[6px] hover:text-white"
							>
								Start a list
							</button>
						</div>
						<dl className="rise mt-14 flex flex-wrap gap-x-10 gap-y-4" style={{ animationDelay: "240ms" }}>
							{[
								["Titles", stats.titles ? stats.titles.toLocaleString() : "-"],
								["Systems", String(stats.systems)],
								["Archive", stats.bytes ? `${(stats.bytes / 1024 / 1024 / 1024).toFixed(1)} GB` : "-"],
							].map(([key, value]) => (
								<div key={key}>
									<dd className="tnum text-[26px] leading-none font-semibold tracking-[-0.04em]">{value}</dd>
									<dt className="faint mt-2 font-mono text-[10.5px] tracking-[0.18em] uppercase">{key}</dt>
								</div>
							))}
						</dl>
						<p className="rise faint mt-8 font-mono text-[10.5px] tracking-[0.16em] uppercase" style={{ animationDelay: "300ms" }}>
							{status} - {sourceLabel} - source {DATA_SOURCE_HOST}
						</p>
					</div>

					{/* floating 3D cartridges: popular records, resolved live */}
					<div
						id="hero-3d"
						className="rise relative mx-auto h-[580px] w-full max-w-[680px] sm:h-[640px] lg:h-[min(760px,86svh)]"
					>
						<div
							aria-hidden
							className="pointer-events-none absolute inset-[8%] rounded-[48%] bg-[radial-gradient(ellipse_at_center,rgba(185,198,225,0.12),rgba(117,132,167,0.045)_42%,transparent_72%)] blur-2xl"
						/>
						{heroItems.length > 0 ? (
							<Suspense
								fallback={
									<HeroCartridgesFallback views={heroItems.slice(0, 3).map((item) => romView(item.rom))} />
								}
							>
								<HeroCartridges items={heroItems} />
							</Suspense>
						) : (
							<p className="faint absolute inset-0 grid place-items-center text-[13px]">
								{loading ? "Casting the hero shelf..." : "Hero shelf unavailable."}
							</p>
						)}
					</div>
				</div>
			</header>

			{/* SPLIT: INDEX + SHELF */}
			<div id="index" className="wrap scroll-mt-4 pb-24">
				<div className="grid items-start gap-12 lg:grid-cols-[1fr_360px]">
					<section className="min-w-0">
						<div className="sticky top-0 z-20 -mx-1 bg-[#0a0a0b]/88 px-1 pt-5 pb-3 backdrop-blur-xl">
							<div className="flex items-center gap-3">
								<MetalMark onClick={() => scrollToId("top")} />
								<div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.03] pr-4 pl-5 focus-within:border-white/30">
									<span className="faint text-[13px]" aria-hidden>
										⌕
									</span>
									<input
										ref={searchRef}
										value={query}
										onChange={(event) => {
											setQuery(event.target.value);
											setVisible(PAGE);
										}}
										placeholder={`Search ${(total || 0).toLocaleString()} records - press /`}
										aria-label="Search the shared index"
										className="bare text-[14px]"
									/>
									{query && (
										<button
											type="button"
											onClick={() => setQuery("")}
											aria-label="Clear search"
											className="faint shrink-0 text-[15px] hover:text-white"
										>
											×
										</button>
									)}
								</div>
								<select
									value={sort}
									onChange={(event) => setSort(event.target.value as SortKey)}
									aria-label="Sort"
									className="hidden h-11 shrink-0 rounded-full border border-white/12 bg-transparent px-4 text-[13px] sm:block"
								>
									{SORTS.map((item) => (
										<option key={item.key} value={item.key} className="bg-[#141416]">
											{item.label}
										</option>
									))}
								</select>
							</div>

							<div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
								<button
									type="button"
									onClick={() => {
										setSystem("all");
										setVisible(PAGE);
									}}
									className={`seg ${system === "all" ? "on" : ""}`}
								>
									All
								</button>
								{consoles.slice(0, 40).map((item) => (
									<button
										key={item.name}
										type="button"
										onClick={() => {
											setSystem(item.name);
											setVisible(PAGE);
										}}
										className={`seg ${system === item.name ? "on" : ""}`}
										title={`${item.name} - ${item.count.toLocaleString()} records`}
									>
										{item.name}
									</button>
								))}
							</div>
						</div>

						<div className="mt-2 flex items-baseline justify-between gap-4">
							<h2 className="text-[13px] tracking-[-0.01em]">
								<span className="tnum">{sorted.length.toLocaleString()}</span>{" "}
								<span className="muted">{sorted.length === 1 ? "record" : "records"}</span>
								{searching && <span className="faint"> for {deferred.trim()}</span>}
							</h2>
							{(query || system !== "all") && (
								<button
									type="button"
									onClick={() => {
										setQuery("");
										setSystem("all");
									}}
									className="faint text-[12.5px] hover:text-white"
								>
									Reset
								</button>
							)}
						</div>

						{searching && (
							<p className="faint mt-1 font-mono text-[10.5px] tracking-[0.14em] uppercase">
								prefix filters live: p: - c: - y:
							</p>
						)}

						{error ? (
							<div className="sheet-card mt-5 p-8 text-center">
								<p className="text-[15px]">The shared index could not be reached.</p>
								<p className="muted mt-2 text-[12.5px] break-words">{error}</p>
								<button
									type="button"
									onClick={() => window.location.reload()}
									className="ghost mt-6 h-9 px-4 text-[12px]"
								>
									Retry
								</button>
							</div>
						) : loading ? (
							<p className="muted py-24 text-center text-[15px]">Loading the shared index...</p>
						) : sorted.length === 0 ? (
							<p className="muted py-24 text-center text-[15px]">Nothing matched. Try a looser word.</p>
						) : (
							<>
								<ul className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.07]">
									{shown.map((rom, index) => {
										const game = romView(rom);
										const isSaved = savedIds.has(rom.id);
										const expanded = openId === rom.id;
										const inLists = inListsFor(rom.id);
										return (
											<li key={rom.id} id={`g-${cssId(rom.id)}`} className="row">
												<div className="flex items-center gap-4 py-3.5">
													<span className="tnum faint hidden w-6 shrink-0 text-[11px] sm:block">
														{String(index + 1).padStart(2, "0")}
													</span>
													<button
														type="button"
														onClick={() => setOpenId(expanded ? null : rom.id)}
														className="shrink-0"
														aria-label={`Details for ${game.title}`}
														aria-expanded={expanded}
													>
														<ShelfCover view={game} compact className="row-thumb h-14 w-[72px]" />
													</button>
													<button
														type="button"
														onClick={() => setOpenId(expanded ? null : rom.id)}
														className="min-w-0 flex-1 text-left"
														aria-expanded={expanded}
													>
														<span className="block truncate text-[15px] font-medium tracking-[-0.025em]">
															{game.title}
														</span>
														<span className="faint block truncate text-[12px]">
															{game.platform} - {game.year ?? "-"} - {game.publisher}
															{inLists.length > 0 && (
																<span className="text-white/45">
																									{" "}
																	- in {inLists.length} {inLists.length === 1 ? "list" : "lists"}
																</span>
															)}
														</span>
													</button>
													<span className="tnum faint hidden w-16 shrink-0 text-right text-[12.5px] sm:block">
														{formatSizeMb(game.sizeMb)}
													</span>
													<button
														type="button"
														onClick={() => toggleSave(rom.id)}
														className={`ghost h-9 shrink-0 px-3.5 text-[12.5px] ${isSaved ? "on" : ""}`}
													>
														{isSaved ? "Kept" : "Keep"}
													</button>
												</div>

												{expanded && (
													<div className="in pb-6 sm:pl-[118px]">
														<p className="muted max-w-[62ch] text-[13.5px] leading-relaxed">
															Filed under {game.publisher} on {game.platform}
														{game.year ? `, dated ${game.year}` : ""}. This row is generated straight from the shared
														index record, so title, company, console, folder, size and date are exactly what the host
														reports.
														</p>
														<dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
															{[
																["System", game.platform],
																["Publisher", game.publisher],
																["Footprint", formatSizeMb(game.sizeMb)],
																["Folder", game.folder || "-"],
																["Date", game.date || "-"],
															].map(([key, value]) => (
																<div key={key}>
																	<dt className="faint font-mono text-[10px] tracking-[0.16em] uppercase">
																		{key}
																	</dt>
																	<dd className="tnum mt-1 max-w-[42ch] truncate text-[13px]">{value}</dd>
																</div>
															))}
														</dl>
														<div className="mt-5 flex flex-wrap items-center gap-2">
															<Link to={`/rom/${game.slug}`} className="ghost h-8 px-3.5 text-[12px]">
																Open record
															</Link>
															<span className="faint mr-1 text-[12.5px]">File into:</span>
															{lists.map((list) => {
																const has = list.items.some((item) => item.romId === rom.id);
																return (
																	<button
																		key={list.id}
																		type="button"
																		onClick={() => toggleListItem(list.id, rom.id)}
																		className={`ghost h-8 px-3 text-[12px] ${has ? "on" : ""}`}
																	>
																		{has ? "✓ " : "+ "}
																		{list.name}
																	</button>
																);
															})}
															<form
																className="underline-field flex items-center gap-2"
																onSubmit={(event) => {
																	event.preventDefault();
																	const data = new FormData(event.currentTarget);
																	const name = String(data.get("name") ?? "");
																	const id = makeList(name);
																	if (id) toggleListItem(id, rom.id);
																	event.currentTarget.reset();
																}}
															>
																<input
																	name="name"
																	required
																	maxLength={NAME_MAX}
																	placeholder="new list..."
																	aria-label="New list name"
																	className="bare w-[130px] py-1 text-[12.5px]"
																/>
																<button type="submit" className="shrink-0 text-[12px] text-white/70 hover:text-white">
																	Add
																</button>
															</form>
														</div>
													</div>
												)}
											</li>
										);
									})}
								</ul>
								{visible < sorted.length && (
									<div className="mt-8 flex flex-col items-center gap-2">
										<button
											type="button"
											onClick={() => setVisible((value) => value + PAGE)}
											className="ghost h-10 px-5 text-[12.5px]"
										>
											Show more
										</button>
										<p className="faint tnum font-mono text-[10.5px]">
											showing {shown.length.toLocaleString()} of {sorted.length.toLocaleString()}
										</p>
									</div>
								)}
							</>
						)}
					</section>

					{/* SHELF, desktop */}
					<aside className="sticky top-5 hidden h-[calc(100svh-2.5rem)] lg:block">
						<div className="flex items-baseline justify-between pb-4">
							<h2 className="text-[15px] font-medium tracking-[-0.03em]">Your shelf</h2>
							<span className="faint font-mono text-[10.5px] tracking-[0.18em] uppercase">Saved here</span>
						</div>
						<div className="h-[calc(100%-2.5rem)]">{shelfPanel}</div>
					</aside>
				</div>
			</div>

			<footer className="wrap border-t border-white/[0.07] py-12 text-center">
				<p className="chrome text-[26px] font-semibold tracking-[-0.05em]">roms.tn</p>
				<p className="faint mt-3 text-[12px]">
					{stats.titles ? stats.titles.toLocaleString() : "-"} records - {consoles.length} systems - one page
				</p>
				<div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
					{[
						["Discover", "/browse"],
						["Library", "/library"],
						["Lists", "/collections"],
						["Systems", "/platforms"],
					].map(([label, href]) => (
						<Link key={href} to={href} className="faint text-[12px] hover:text-white">
							{label}
						</Link>
					))}
				</div>
			</footer>

			{/* SHELF, mobile trigger + sheet */}
			<div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden">
				<MetalButton size="sm" onClick={() => setSheet(true)}>
					Your shelf - {library.length + lists.length}
				</MetalButton>
			</div>

			{sheet && (
				<div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
					<button
						type="button"
						aria-label="Close shelf"
						onClick={() => setSheet(false)}
						className="absolute inset-0 bg-black/65 backdrop-blur-sm"
					/>
					<div className="sheet-up absolute inset-x-0 bottom-0 flex h-[80svh] flex-col rounded-t-3xl border-t border-white/10 bg-[#0d0d0f] p-5">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-[15px] font-medium tracking-[-0.03em]">Your shelf</h2>
							<button
								type="button"
								onClick={() => setSheet(false)}
								aria-label="Close"
								className="ghost grid h-9 w-9 place-items-center text-[15px]"
							>
								×
							</button>
						</div>
						<div className="min-h-0 flex-1">{shelfPanel}</div>
					</div>
				</div>
			)}
		</div>
	);
}

/** Ids come from host paths, so they are not safe as raw DOM ids. */
function cssId(romId: string): string {
	let hash = 2166136261;
	for (let i = 0; i < romId.length; i++) {
		hash ^= romId.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return Math.abs(hash).toString(36);
}
