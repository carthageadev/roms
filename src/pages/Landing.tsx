/**
 * A quiet home for the archive: cartridge gallery, live searchable index,
 * and a personal shelf. Records come from the shared index; saves and lists
 * stay in localStorage. Browsing and curation need no account or route change.
 */

import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Link } from "react-router-dom";
import type { HeroCartridge } from "../components/HeroCartridges";
import HeroCartridgesFallback from "../components/HeroCartridgesFallback";
import { MetalMark, scrollToId } from "../components/metal";
import { resolveHeroArt } from "../lib/cover-art";
import { resolveHero } from "../lib/hero";

const loadHero = () => import("../components/HeroCartridges");
const HeroCartridges = lazy(loadHero);

import { ShelfCover } from "../components/ui";
import {
	CANON_TEMPLATES,
	type ResolvedCanonItem,
	resolveCanon,
} from "../lib/canon";
import {
	createList,
	deleteList,
	moveListItem,
	NAME_MAX,
	toggleListItem,
	toggleSave,
} from "../lib/library-store";
import { DATA_SOURCE_HOST, useRomIndex } from "../lib/rom-index-context";
import { formatSizeMb, type RomView, romView } from "../lib/rom-view";
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
	const { view, total, loading, error } = useRomIndex();
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
	const sheetRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		void loadHero();
	}, []);

	useEffect(() => {
		if (!sheet || !sheetRef.current) return;
		const panel = sheetRef.current;
		const previous =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		panel
			.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
			?.focus();
		const onTab = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;
			const targets = [
				...panel.querySelectorAll<HTMLElement>(
					'button:not(:disabled), input, select, a[href], [tabindex="0"]',
				),
			].filter((element) => element.getClientRects().length > 0);
			const first = targets[0];
			const last = targets[targets.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		};
		panel.addEventListener("keydown", onTab);
		return () => {
			panel.removeEventListener("keydown", onTab);
			previous?.focus({ preventScroll: true });
		};
	}, [sheet]);

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
		for (const rom of view.roms)
			counts.set(
				rom.console || "Unknown",
				(counts.get(rom.console || "Unknown") ?? 0) + 1,
			);
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
					Number(b.date?.slice(0, 4) || 0) - Number(a.date?.slice(0, 4) || 0) ||
					a.title.localeCompare(b.title),
			);
		} else {
			copy.sort(
				(a, b) =>
					(b.sizeBytes ?? 0) - (a.sizeBytes ?? 0) ||
					a.title.localeCompare(b.title),
			);
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
			.filter(
				(row): row is { game: RomView; entry: (typeof saves)[string] } =>
					row !== null,
			);
		rows.sort(
			(a, b) =>
				Number(b.entry.pinned) - Number(a.entry.pinned) ||
				b.entry.createdAt.localeCompare(a.entry.createdAt),
		);
		return rows;
	}, [saves, view.byId]);

	const lists: ShelfList[] = useMemo(
		() =>
			collections.map((collection) => ({
				id: collection.id,
				name: collection.name,
				note: collection.note,
				curator: collection.curator,
				items: collection.items.map((item) => ({
					romId: item.romId,
					curatorNote: item.curatorNote,
				})),
			})),
		[collections],
	);

	const inListsFor = useCallback(
		(romId: string) =>
			lists.filter((list) => list.items.some((item) => item.romId === romId)),
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
		() =>
			heroResolved.map((item) => ({
				rom: item.rom,
				artUrl: heroArt.get(item.rom.title) ?? null,
			})),
		[heroResolved, heroArt],
	);

	const canons = useMemo(
		() =>
			CANON_TEMPLATES.map((template) => ({
				template,
				resolved: resolveCanon(view.roms, template),
			})),
		[view.roms],
	);

	const stats = { titles: total, systems: consoles.length };
	const openShelf = () => {
		if (window.matchMedia("(min-width: 1024px)").matches) scrollToId("shelf");
		else setSheet(true);
	};

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
		<div className="shelf-panel flex h-full flex-col">
			<div className="shelf-tabs flex gap-1">
				<button
					className={`tab ${tab === "library" ? "on" : ""}`}
					onClick={() => setTab("library")}
					type="button"
				>
					Library <span className="tnum faint ml-1">{library.length}</span>
				</button>
				<button
					className={`tab ${tab === "lists" ? "on" : ""}`}
					onClick={() => setTab("lists")}
					type="button"
				>
					Lists <span className="tnum faint ml-1">{lists.length}</span>
				</button>
			</div>

			<div className="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
				{tab === "library" ? (
					library.length === 0 ? (
						<div className="empty-shelf">
							<svg
								aria-hidden="true"
								fill="none"
								height="36"
								stroke="currentColor"
								strokeWidth="1"
								viewBox="0 0 30 36"
								width="30"
							>
								<path d="M6 5h18v26l-9-6-9 6V5Z" />
								<path d="M10 11h10M10 15h7" />
							</svg>
							<p className="text-[14px]">Your shelf is empty.</p>
							<p className="muted mt-1.5 text-[12.5px]">
								Keep a game. Come back whenever.
							</p>
						</div>
					) : (
						<ul className="space-y-1">
							{library.map((row) => (
								<li
									className="in flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.04]"
									key={row.game.id}
								>
									<ShelfCover
										className="h-10 w-12 shrink-0"
										compact
										view={row.game}
									/>
									<Link
										className="min-w-0 flex-1 text-left"
										onClick={() => setSheet(false)}
										to={`/rom/${row.game.slug}`}
									>
										<span className="block truncate text-[13.5px]">
											{row.game.title}
										</span>
										<span className="faint block text-[11.5px]">
											{row.game.platform}
										</span>
									</Link>
									<button
										aria-label={`Remove ${row.game.title}`}
										className="faint shrink-0 px-1.5 text-[15px] hover:text-white"
										onClick={() => toggleSave(row.game.id)}
										type="button"
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
								aria-label="Name a list"
								className="bare py-1.5 text-[14px]"
								maxLength={NAME_MAX}
								onChange={(event) => setListName(event.target.value)}
								placeholder="Name a list..."
								value={listName}
							/>
							<button
								className="shrink-0 text-[13px] text-white/70 hover:text-white disabled:opacity-30"
								disabled={!listName.trim()}
								type="submit"
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
										.filter((rom): rom is NonNullable<typeof rom> =>
											Boolean(rom),
										)
										.map(romView);
									const totalMb = ordered.reduce(
										(sum, game) => sum + (game.sizeMb ?? 0),
										0,
									);
									return (
										<li className="rounded-xl" key={list.id}>
											<button
												aria-expanded={open}
												className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/[0.04]"
												onClick={() => setOpenList(open ? null : list.id)}
												type="button"
											>
												<span className="flex -space-x-2">
													{ordered.slice(0, 3).map((game) => (
														<ShelfCover
															className="h-8 w-8 ring-2 ring-[#0a0a0b]"
															compact
															key={game.id}
															view={game}
														/>
													))}
													{ordered.length === 0 && (
														<span className="faint grid h-8 w-8 place-items-center rounded-xl border border-white/20 border-dashed text-[12px]">
															+
														</span>
													)}
												</span>
												<span className="min-w-0 flex-1 truncate text-[13.5px]">
													{list.name}
												</span>
												<span className="tnum faint text-[12px]">
													{ordered.length}
												</span>
											</button>

											{open && (
												<div className="in pb-3 pl-2">
													{list.note && (
														<p className="faint px-1 pb-2 text-[11.5px] leading-relaxed">
															{list.note}
														</p>
													)}
													<p className="faint tnum px-1 pb-2 text-[11px]">
														{formatSizeMb(totalMb)}
														{list.curator
															? ` - curated by ${list.curator}`
															: ""}
													</p>
													{ordered.length === 0 ? (
														<p className="faint px-1 py-2 text-[12px]">
															Empty - press + on a record to file it here.
														</p>
													) : (
														<ol className="space-y-0.5">
															{ordered.map((game, index) => (
																<li
																	className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/[0.03]"
																	key={game.id}
																>
																	<span className="tnum faint w-5 text-[11px]">
																		{index + 1}
																	</span>
																	<Link
																		className="min-w-0 flex-1 truncate text-[12.5px] hover:underline"
																		onClick={() => setSheet(false)}
																		to={`/rom/${game.slug}`}
																	>
																		{game.title}
																	</Link>
																	<button
																		aria-label="Move up"
																		className="faint px-1 hover:text-white disabled:opacity-20"
																		disabled={index === 0}
																		onClick={() =>
																			moveListItem(list.id, game.id, "up")
																		}
																		type="button"
																	>
																		↑
																	</button>
																	<button
																		aria-label="Move down"
																		className="faint px-1 hover:text-white disabled:opacity-20"
																		disabled={index === ordered.length - 1}
																		onClick={() =>
																			moveListItem(list.id, game.id, "down")
																		}
																		type="button"
																	>
																		↓
																	</button>
																	<button
																		aria-label={`Remove ${game.title}`}
																		className="faint px-1 hover:text-white"
																		onClick={() =>
																			toggleListItem(list.id, game.id)
																		}
																		type="button"
																	>
																		×
																	</button>
																</li>
															))}
														</ol>
													)}
													<Link
														className="faint mt-2 inline-block px-1 text-[11.5px] hover:text-white"
														onClick={() => setSheet(false)}
														to={`/collections/${list.id}`}
													>
														Open workbench →
													</Link>
													<button
														className="faint mt-2 ml-3 px-1 text-[11.5px] hover:text-white"
														onClick={() => deleteList(list.id)}
														type="button"
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

						<p className="faint mt-7 mb-3 font-mono text-[10.5px] uppercase tracking-[0.2em]">
							Or clone a canon
						</p>
						<div className="space-y-2">
							{canons.map(({ template, resolved }) => (
								<div className="sheet-card p-3.5" key={template.key}>
									<div className="flex items-baseline justify-between gap-3">
										<p className="font-medium text-[13px] tracking-[-0.02em]">
											{template.name}
										</p>
										<span className="faint tnum font-mono text-[10px]">
											{template.code}
										</span>
									</div>
									<p className="muted mt-1 line-clamp-2 text-[11.5px] leading-relaxed">
										{template.note}
									</p>
									<div className="mt-3 flex items-center justify-between">
										<span className="flex -space-x-2">
											{resolved.slice(0, 4).map((item) => (
												<ShelfCover
													className="h-7 w-7 ring-2 ring-[#0a0a0b]"
													compact
													key={item.rom.id}
													view={romView(item.rom)}
												/>
											))}
										</span>
										<button
											className="ghost h-8 px-3.5 text-[12px]"
											onClick={() => cloneCanon(template.key)}
											type="button"
										>
											Clone
										</button>
									</div>
									{resolved.length < template.intents.length && (
										<p className="faint mt-2 text-[10.5px]">
											{template.intents.length - resolved.length} entries not in
											the shared index yet.
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
		<div className="landing" id="top">
			<nav aria-label="Main navigation" className="landing-nav landing-wrap">
				<div className="landing-brand">
					<MetalMark onClick={() => scrollToId("top")} />
					<a className="brand-name" href="#top">
						roms.tn
					</a>
				</div>
				<div className="landing-nav-links">
					<a href="#index">The index</a>
					<button onClick={openShelf} type="button">
						Your shelf <span className="nav-count">{library.length}</span>
					</button>
				</div>
			</nav>

			<header className="landing-hero landing-wrap">
				<div className="hero-copy">
					<p className="eyebrow">
						<span className="quiet-dot" /> A small place for the classics
					</p>
					<h1>
						Still worth
						<br />
						<span className="hero-chrome">playing.</span>
					</h1>
					<p className="hero-description">
						Find an old favorite. Make a new collection.
					</p>
					<div className="hero-actions">
						<button
							className="chrome-action"
							onClick={() => {
								scrollToId("index");
								searchRef.current?.focus({ preventScroll: true });
							}}
							type="button"
						>
							Explore the index <span aria-hidden>↗</span>
						</button>
						<button
							className="quiet-action"
							onClick={() => {
								setTab("lists");
								openShelf();
							}}
							type="button"
						>
							Make a list
						</button>
					</div>
					<div className="hero-note">
						<span className="fine-rule" /> No account. Just your favorites.
					</div>
				</div>

				<div className="hero-gallery" id="hero-3d">
					<div aria-hidden className="gallery-halo" />
					{heroItems.length > 0 ? (
						<Suspense
							fallback={
								<HeroCartridgesFallback
									views={heroItems.map((item) => romView(item.rom))}
								/>
							}
						>
							<HeroCartridges items={heroItems} />
						</Suspense>
					) : (
						<p className="gallery-loading">
							{loading
								? "Opening the collection..."
								: "The collection is taking a moment."}
						</p>
					)}
				</div>
				<div className="hero-baseline">
					<p>
						<span className="tnum">
							{stats.titles ? stats.titles.toLocaleString() : "-"}
						</span>{" "}
						titles <span className="baseline-slash">/</span>{" "}
						<span className="tnum">{stats.systems || "-"}</span> systems
					</p>
					<a href="#index">
						A whole archive, a little closer <span aria-hidden>↓</span>
					</a>
				</div>
			</header>

			{/* SPLIT: INDEX + SHELF */}
			<div className="landing-wrap archive-section" id="index">
				<div className="section-heading">
					<div>
						<p className="eyebrow">01 / Explore</p>
						<h2>
							The index<span className="heading-dot">.</span>
						</h2>
					</div>
					<p className="section-description">
						All the possibilities.
						<br />
						One place to begin.
					</p>
				</div>
				<div className="archive-grid">
					<section className="min-w-0">
						<div className="archive-controls">
							<div className="archive-search-row">
								<div className="archive-search">
									<svg
										aria-hidden="true"
										fill="none"
										height="18"
										stroke="currentColor"
										strokeWidth="1.5"
										viewBox="0 0 24 24"
										width="18"
									>
										<circle cx="10.5" cy="10.5" r="6.5" />
										<path d="m16 16 4 4" />
									</svg>
									<input
										aria-label="Search the shared index"
										className="bare text-[14px]"
										onChange={(event) => {
											setQuery(event.target.value);
											setVisible(PAGE);
										}}
										placeholder="Search a game, a system, a memory..."
										ref={searchRef}
										value={query}
									/>
									{query && (
										<button
											aria-label="Clear search"
											className="faint shrink-0 text-[15px] hover:text-white"
											onClick={() => setQuery("")}
											type="button"
										>
											×
										</button>
									)}
									{!query && <kbd className="search-key">/</kbd>}
								</div>
							</div>
							<div className="archive-filter-row">
								<select
									aria-label="Filter by system"
									className="archive-select"
									onChange={(event) => {
										setSystem(event.target.value);
										setVisible(PAGE);
									}}
									value={system}
								>
									<option value="all">All systems</option>
									{consoles.map((item) => (
										<option key={item.name} value={item.name}>
											{item.name}
										</option>
									))}
								</select>
								<select
									aria-label="Sort"
									className="archive-select"
									onChange={(event) => setSort(event.target.value as SortKey)}
									value={sort}
								>
									{SORTS.map((item) => (
										<option
											className="bg-[#141416]"
											key={item.key}
											value={item.key}
										>
											{item.label}
										</option>
									))}
								</select>
							</div>
						</div>

						<div className="mt-2 flex items-baseline justify-between gap-4">
							<h2 className="text-[13px] tracking-[-0.01em]">
								<span className="tnum">{sorted.length.toLocaleString()}</span>{" "}
								<span className="muted">
									{sorted.length === 1 ? "record" : "records"}
								</span>
								{searching && (
									<span className="faint"> for {deferred.trim()}</span>
								)}
							</h2>
							{(query || system !== "all") && (
								<button
									className="faint text-[12.5px] hover:text-white"
									onClick={() => {
										setQuery("");
										setSystem("all");
									}}
									type="button"
								>
									Reset
								</button>
							)}
						</div>

						{searching && (
							<p className="faint mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em]">
								prefix filters live: p: - c: - y:
							</p>
						)}

						{error ? (
							<div className="sheet-card mt-5 p-8 text-center">
								<p className="text-[15px]">
									The shared index could not be reached.
								</p>
								<p className="muted mt-2 break-words text-[12.5px]">{error}</p>
								<button
									className="ghost mt-6 h-9 px-4 text-[12px]"
									onClick={() => window.location.reload()}
									type="button"
								>
									Retry
								</button>
							</div>
						) : loading ? (
							<p className="muted py-24 text-center text-[15px]">
								Loading the shared index...
							</p>
						) : sorted.length === 0 ? (
							<p className="muted py-24 text-center text-[15px]">
								Nothing matched. Try a looser word.
							</p>
						) : (
							<>
								<ul className="mt-3 divide-y divide-white/[0.07] border-white/[0.07] border-y">
									{shown.map((rom, index) => {
										const game = romView(rom);
										const isSaved = savedIds.has(rom.id);
										const expanded = openId === rom.id;
										const inLists = inListsFor(rom.id);
										return (
											<li
												className="row"
												id={`g-${cssId(rom.id)}`}
												key={rom.id}
											>
												<div className="flex items-center gap-4 py-3.5">
													<span className="tnum faint hidden w-6 shrink-0 text-[11px] sm:block">
														{String(index + 1).padStart(2, "0")}
													</span>
													<button
														aria-expanded={expanded}
														aria-label={`Details for ${game.title}`}
														className="shrink-0"
														onClick={() => setOpenId(expanded ? null : rom.id)}
														type="button"
													>
														<ShelfCover
															className="row-thumb h-14 w-[72px]"
															compact
															view={game}
														/>
													</button>
													<button
														aria-expanded={expanded}
														className="min-w-0 flex-1 text-left"
														onClick={() => setOpenId(expanded ? null : rom.id)}
														type="button"
													>
														<span className="block truncate font-medium text-[15px] tracking-[-0.025em]">
															{game.title}
														</span>
														<span className="faint block truncate text-[12px]">
															{game.platform}
															{inLists.length > 0 && (
																<span className="text-white/45">
																	{" "}
																	- in {inLists.length}{" "}
																	{inLists.length === 1 ? "list" : "lists"}
																</span>
															)}
														</span>
													</button>
													<span className="tnum faint hidden w-16 shrink-0 text-right text-[12.5px] sm:block">
														{formatSizeMb(game.sizeMb)}
													</span>
													<button
														className={`ghost h-9 shrink-0 px-3.5 text-[12.5px] ${isSaved ? "on" : ""}`}
														onClick={() => toggleSave(rom.id)}
														type="button"
													>
														{isSaved ? "Kept" : "Keep"}
													</button>
												</div>

												{expanded && (
													<div className="in pb-6 sm:pl-[118px]">
														<dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
															{[
																["System", game.platform],
																["Publisher", game.publisher],
																["Footprint", formatSizeMb(game.sizeMb)],
																["Folder", game.folder || "-"],
																["Date", game.date || "-"],
															].map(([key, value]) => (
																<div key={key}>
																	<dt className="faint font-mono text-[10px] uppercase tracking-[0.16em]">
																		{key}
																	</dt>
																	<dd className="tnum mt-1 max-w-[42ch] truncate text-[13px]">
																		{value}
																	</dd>
																</div>
															))}
														</dl>
														<div className="mt-5 flex flex-wrap items-center gap-2">
															<Link
																className="ghost h-8 px-3.5 text-[12px]"
																to={`/rom/${game.slug}`}
															>
																Open record
															</Link>
															<span className="faint mr-1 text-[12.5px]">
																File into:
															</span>
															{lists.map((list) => {
																const has = list.items.some(
																	(item) => item.romId === rom.id,
																);
																return (
																	<button
																		className={`ghost h-8 px-3 text-[12px] ${has ? "on" : ""}`}
																		key={list.id}
																		onClick={() =>
																			toggleListItem(list.id, rom.id)
																		}
																		type="button"
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
																	const data = new FormData(
																		event.currentTarget,
																	);
																	const name = String(data.get("name") ?? "");
																	const id = makeList(name);
																	if (id) toggleListItem(id, rom.id);
																	event.currentTarget.reset();
																}}
															>
																<input
																	aria-label="New list name"
																	className="bare w-[130px] py-1 text-[12.5px]"
																	maxLength={NAME_MAX}
																	name="name"
																	placeholder="new list..."
																	required
																/>
																<button
																	className="shrink-0 text-[12px] text-white/70 hover:text-white"
																	type="submit"
																>
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
											className="ghost h-10 px-5 text-[12.5px]"
											onClick={() => setVisible((value) => value + PAGE)}
											type="button"
										>
											Show more
										</button>
										<p className="faint tnum font-mono text-[10.5px]">
											showing {shown.length.toLocaleString()} of{" "}
											{sorted.length.toLocaleString()}
										</p>
									</div>
								)}
							</>
						)}
					</section>

					{/* SHELF, desktop */}
					<aside className="archive-shelf" id="shelf">
						<div className="shelf-heading">
							<h2>Your shelf</h2>
							<span className="eyebrow">Only yours</span>
						</div>
						<div className="min-h-0 flex-1">{shelfPanel}</div>
					</aside>
				</div>
			</div>

			<footer className="landing-wrap landing-footer">
				<div>
					<a className="brand-name" href="#top">
						roms.tn
					</a>
					<p>A quiet corner of the archive.</p>
				</div>
				<div className="footer-links">
					{[
						["Discover", "/browse"],
						["Library", "/library"],
						["Lists", "/collections"],
						["Systems", "/platforms"],
					].map(([label, href]) => (
						<Link
							className="faint text-[12px] hover:text-white"
							key={href}
							to={href}
						>
							{label}
						</Link>
					))}
				</div>
				<p className="footer-source" title={DATA_SOURCE_HOST}>
					Live index. Locally kept.
				</p>
			</footer>

			{/* SHELF, mobile trigger + sheet */}
			<div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-end pr-5 pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden">
				<button
					className="mobile-shelf-button"
					onClick={() => setSheet(true)}
					type="button"
				>
					Your shelf <span>{library.length + lists.length}</span>
				</button>
			</div>

			{sheet && (
				<div
					aria-label="Your shelf"
					aria-modal="true"
					className="fixed inset-0 z-[60] lg:hidden"
					role="dialog"
				>
					<button
						aria-label="Close shelf"
						className="absolute inset-0 bg-black/65 backdrop-blur-sm"
						onClick={() => setSheet(false)}
						type="button"
					/>
					<div
						className="sheet-up absolute inset-x-0 bottom-0 flex h-[80svh] flex-col rounded-t-3xl border-white/10 border-t bg-[#0d0d0f] p-5"
						ref={sheetRef}
					>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-medium text-[15px] tracking-[-0.03em]">
								Your shelf
							</h2>
							<button
								aria-label="Close"
								className="ghost grid h-9 w-9 place-items-center text-[15px]"
								onClick={() => setSheet(false)}
								type="button"
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
