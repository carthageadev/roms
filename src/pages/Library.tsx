import { useEffect, useMemo, useState } from "react";
import { useAtlasData } from "../hooks/useAtlasData";
import { getWeeklyFeatured, searchRoms, type SortKey } from "../lib/atlas";
import { Navbar } from "../components/Navbar";
import { RomCard } from "../components/RomCard";
import { SpotlightCard } from "../components/SpotlightCard";

const PAGE_SIZE = 48;
const SORTS: { value: SortKey; label: string }[] = [
	{ value: "relevance", label: "relevance" },
	{ value: "title-asc", label: "title a-z" },
	{ value: "title-desc", label: "title z-a" },
	{ value: "console-asc", label: "console a-z" },
	{ value: "company-asc", label: "company a-z" },
	{ value: "size-desc", label: "size desc" },
	{ value: "size-asc", label: "size asc" },
	{ value: "date-desc", label: "date desc" },
];

function readUrl(): {
	q: string;
	company: string;
	consoleVal: string;
	folder: string;
	sort: SortKey;
} {
	const p = new URLSearchParams(window.location.search);
	const sort = p.get("sort") as SortKey | null;
	return {
		q: p.get("q") ?? "",
		company: p.get("company") ?? "",
		consoleVal: p.get("console") ?? "",
		folder: p.get("folder") ?? "",
		sort: SORTS.some((s) => s.value === sort) ? (sort as SortKey) : "relevance",
	};
}

export function LibraryPage() {
	const { meta, docs, companies, consoles, base, loading, progress, error } =
		useAtlasData();

	const [q, setQ] = useState("");
	const [company, setCompany] = useState("");
	const [consoleVal, setConsoleVal] = useState("");
	const [folder, setFolder] = useState("");
	const [sortBy, setSortBy] = useState<SortKey>("relevance");
	const [page, setPage] = useState(0);
	const [debouncedQ, setDebouncedQ] = useState("");

	// Init from URL once.
	useEffect(() => {
		const init = readUrl();
		setQ(init.q);
		setDebouncedQ(init.q);
		setCompany(init.company);
		setConsoleVal(init.consoleVal);
		setFolder(init.folder);
		setSortBy(init.sort);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Debounce search input (mirrors atlas 120ms).
	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedQ(q);
			setPage(0);
		}, 150);
		return () => clearTimeout(t);
	}, [q]);

	useEffect(() => {
		setPage(0);
	}, [company, consoleVal, folder, sortBy]);

	// Sync back to URL.
	useEffect(() => {
		const p = new URLSearchParams();
		if (debouncedQ) p.set("q", debouncedQ);
		if (company) p.set("company", company);
		if (consoleVal) p.set("console", consoleVal);
		if (folder) p.set("folder", folder);
		if (sortBy !== "relevance") p.set("sort", sortBy);
		const qs = p.toString();
		window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
	}, [debouncedQ, company, consoleVal, folder, sortBy]);

	const results = useMemo(
		() =>
			searchRoms(docs, {
				q: debouncedQ,
				company,
				consoleVal,
				folderSub: folder,
				sortBy,
			}),
		[docs, debouncedQ, company, consoleVal, folder, sortBy],
	);

	const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages - 1);
	const slice = results.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

	const isActive =
		debouncedQ.trim() !== "" || company !== "" || consoleVal !== "" || folder.trim() !== "";

	const spotlight = useMemo(() => getWeeklyFeatured(docs), [docs]);

	const clearAll = () => {
		setQ("");
		setDebouncedQ("");
		setCompany("");
		setConsoleVal("");
		setFolder("");
		setSortBy("relevance");
		setPage(0);
	};

	return (
		<main className="relative min-h-screen pb-32">
			<Navbar />
			<div className="mx-auto max-w-7xl px-6 pt-36">
				<header className="mb-10">
					<div className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-accent-gold">
						Live library · same data as Atlas
					</div>
					<h1 className="font-display text-5xl font-medium tracking-tight md:text-6xl">
						Search the Vault
					</h1>
					<p className="mt-4 max-w-2xl text-text-secondary">
						{loading
							? (progress || "Loading Atlas index…")
							: meta
								? `${docs.length.toLocaleString()} files indexed · updated ${new Date(meta.generatedAt).toLocaleString()} · src ${meta.baseUrl}`
								: `${docs.length.toLocaleString()} files indexed`}
						{base ? ` · via ${base}` : ""}
					</p>
					{error ? (
						<p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
							Failed to load index: {error}
						</p>
					) : null}
				</header>

				{/* Search controls */}
				<div className="glass-panel mb-8 p-6">
					<div className="mb-4 flex items-center gap-3">
						<span className="text-text-dim" aria-hidden="true">&gt;</span>
						<input
							aria-label="Search ROMs"
							className="w-full bg-transparent text-lg outline-none placeholder:text-text-dim"
							disabled={loading}
							onChange={(e) => setQ(e.target.value)}
							placeholder='search roms… try "zelda", "mario", "sonic"'
							value={q}
						/>
						<button
							className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-text-secondary hover:bg-white/10 hover:text-white"
							onClick={clearAll}
							type="button"
						>
							{q === "" ? "[>]" : "[x]"}
						</button>
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-text-dim">
							Company
							<select
								className="rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-sm normal-case tracking-normal text-white"
								disabled={loading}
								onChange={(e) => setCompany(e.target.value)}
								value={company}
							>
								<option value="">all</option>
								{companies.map((c) => (
									<option key={c} value={c}>
										{c}
									</option>
								))}
							</select>
						</label>
						<label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-text-dim">
							Console
							<select
								className="rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-sm normal-case tracking-normal text-white"
								disabled={loading}
								onChange={(e) => setConsoleVal(e.target.value)}
								value={consoleVal}
							>
								<option value="">all</option>
								{consoles.map((c) => (
									<option key={c} value={c}>
										{c || "-"}
									</option>
								))}
							</select>
						</label>
						<label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-text-dim">
							Folder
							<input
								className="rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none placeholder:text-text-dim"
								disabled={loading}
								onChange={(e) => setFolder(e.target.value)}
								placeholder="/Nintendo/Wii"
								value={folder}
							/>
						</label>
						<label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-text-dim">
							Sort
							<select
								className="rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-sm normal-case tracking-normal text-white"
								disabled={loading}
								onChange={(e) => setSortBy(e.target.value as SortKey)}
								value={sortBy}
							>
								{SORTS.map((s) => (
									<option key={s.value} value={s.value}>
										{s.label}
									</option>
								))}
							</select>
						</label>
					</div>
				</div>

				{/* Product of the week - only on idle (no active search), like a hero */}
				{!isActive && spotlight ? (
					<div className="mb-12">
						<SpotlightCard
							rom={spotlight.rom}
							week={spotlight.week}
							year={spotlight.year}
						/>
					</div>
				) : null}

				<div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
					<p className="text-sm text-text-secondary">
						{results.length === 0
							? "No results"
							: `Showing ${safePage * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE + PAGE_SIZE, results.length)} of ${results.length.toLocaleString()} results`}
					</p>
					<p className="text-xs uppercase tracking-[0.25em] text-text-dim">
						Page {safePage + 1} / {totalPages}
					</p>
				</div>

				{loading ? (
					<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								className="glass-panel h-44 animate-pulse"
								key={i}
							/>
						))}
					</div>
				) : slice.length === 0 ? (
					<div className="glass-panel p-10 text-center text-text-secondary">
						no results. try "zelda", "mario", "sonic".
					</div>
				) : (
					<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{slice.map((rom) => (
							<RomCard key={rom.id} rom={rom} />
						))}
					</div>
				)}

				<div className="mt-10 flex items-center justify-center gap-6">
					<button
						className="btn-luxe btn-outline !rounded-xl !px-6 !py-3 !text-xs disabled:opacity-40"
						disabled={safePage === 0}
						onClick={() => {
							setPage(safePage - 1);
							window.scrollTo({ top: 0, behavior: "smooth" });
						}}
						type="button"
					>
						[&lt;] Prev
					</button>
					<span className="text-xs uppercase tracking-[0.25em] text-text-dim">
						Page {safePage + 1} / {totalPages}
					</span>
					<button
						className="btn-luxe btn-outline !rounded-xl !px-6 !py-3 !text-xs disabled:opacity-40"
						disabled={safePage >= totalPages - 1}
						onClick={() => {
							setPage(safePage + 1);
							window.scrollTo({ top: 0, behavior: "smooth" });
						}}
						type="button"
					>
						Next [&gt;]
					</button>
				</div>

				<p className="mt-12 text-center text-[11px] uppercase tracking-[0.3em] text-text-dim">
					Data: Atlas scraper (lolroms.com) · weekly build · consumed read-only -
					no new scraper in roms-tn
				</p>
			</div>
		</main>
	);
}
