import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MetalSearchConsole } from "../components/metal";
import { RomCard } from "../components/ui";
import { useRomIndex } from "../lib/rom-index-context";
import { searchRoms } from "../lib/roms";
import { consoleStats, romView, topCompanies } from "../lib/rom-view";

const SORTS = [
	{ key: "index", label: "Index order" },
	{ key: "az", label: "A–Z" },
	{ key: "za", label: "Z–A" },
	{ key: "year", label: "Newest" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const PAGE_SIZE = 120;

export default function BrowsePage() {
	const { view, total, loading, error } = useRomIndex();
	const [params, setParams] = useSearchParams();
	const query = params.get("q") ?? "";
	const consoleFilter = params.get("console") ?? "all";
	const companyFilter = params.get("company") ?? "all";
	const sort = (params.get("sort") ?? "index") as SortKey;

	const [draft, setDraft] = useState(query);
	const [deferred, setDeferred] = useState(query);
	const [visible, setVisible] = useState(PAGE_SIZE);

	// Keep the console in sync when the user lands on /browse?console=… directly.
	useEffect(() => {
		setDraft(query);
		setDeferred(query);
		setVisible(PAGE_SIZE);
	}, [query]);

	// Debounce so typing never blocks the paint on a large index.
	useEffect(() => {
		const timer = window.setTimeout(() => setDeferred(draft), 120);
		return () => window.clearTimeout(timer);
	}, [draft]);

	const consoles = useMemo(() => consoleStats(view.roms), [view.roms]);
	const companies = useMemo(() => topCompanies(view.roms, 60), [view.roms]);

	const update = (key: string, value: string) => {
		const next = new URLSearchParams(params);
		if (!value || value === "all" || (key === "sort" && value === "index")) next.delete(key);
		else next.set(key, value);
		setParams(next, { replace: true });
		setVisible(PAGE_SIZE);
	};

	const results = useMemo(() => {
		const text = deferred.trim();
		if (text) {
			return searchRoms(view.roms, text).hits.map((hit) => hit.rom);
		}
		if (consoleFilter !== "all") {
			const base = view.roms.filter((rom) => rom.console === consoleFilter);
			return companyFilter === "all" ? base : base.filter((rom) => rom.company === companyFilter);
		}
		if (companyFilter !== "all") return view.roms.filter((rom) => rom.company === companyFilter);
		return view.roms;
	}, [companyFilter, consoleFilter, deferred, view.roms]);

	const sorted = useMemo(() => {
		if (sort === "index") return results;
		const copy = [...results];
		if (sort === "az") copy.sort((a, b) => a.title.localeCompare(b.title));
		else if (sort === "za") copy.sort((a, b) => b.title.localeCompare(a.title));
		else {
			copy.sort((a, b) => (Number(b.date?.slice(0, 4) || 0) - Number(a.date?.slice(0, 4) || 0)) || a.title.localeCompare(b.title));
		}
		return copy;
	}, [results, sort]);

	const shown = sorted.slice(0, visible);
	const searching = deferred.trim().length > 0;

	return (
		<div className="mx-auto max-w-[980px] px-5 pb-14 pt-28 sm:pt-32">
			<div className="max-w-[660px]">
				<h1 className="text-[38px] font-semibold tracking-[-0.05em] text-white sm:text-[48px]">Find something good.</h1>
				<div className="mt-7">
					<MetalSearchConsole
						key={query}
						defaultQuery={query}
						totalTitles={total}
						placeholder="Search a game, or try p:n64 c:nintendo"
					/>
				</div>
			</div>

			<form
				className="mt-7 flex flex-wrap items-center gap-3 border-y border-white/[0.14] py-4"
				onSubmit={(event) => {
					event.preventDefault();
					const next = new URLSearchParams();
					if (draft.trim()) next.set("q", draft.trim());
					if (consoleFilter !== "all") next.set("console", consoleFilter);
					if (companyFilter !== "all") next.set("company", companyFilter);
					if (sort !== "index") next.set("sort", sort);
					setParams(next, { replace: true });
				}}
			>
				<select
					value={consoleFilter}
					aria-label="System"
					onChange={(event) => update("console", event.target.value)}
					className="h-8 max-w-[190px] bg-transparent pr-6 text-[13px] text-white/75 outline-none"
				>
					<option value="all">All systems</option>
					{consoles.map((item) => (
						<option key={item.name} value={item.name}>
							{item.name} ({item.count.toLocaleString()})
						</option>
					))}
				</select>
				<span className="h-4 w-px bg-white/[0.16]" />
				<select
					value={companyFilter}
					aria-label="Publisher"
					onChange={(event) => update("company", event.target.value)}
					className="h-8 max-w-[190px] bg-transparent pr-6 text-[13px] text-white/75 outline-none"
				>
					<option value="all">Any publisher</option>
					{companies.map((item) => (
						<option key={item.name} value={item.name}>
							{item.name} ({item.count.toLocaleString()})
						</option>
					))}
				</select>
				<span className="h-4 w-px bg-white/[0.16]" />
				<select
					value={sort}
					aria-label="Order"
					onChange={(event) => update("sort", event.target.value)}
					className="h-8 bg-transparent pr-6 text-[13px] text-white/75 outline-none"
				>
					{SORTS.map((item) => (
						<option key={item.key} value={item.key}>
							{item.label}
						</option>
					))}
				</select>
				<button type="submit" className="text-[13px] text-white/75 hover:text-white">
					Apply
				</button>
				{(query || consoleFilter !== "all" || companyFilter !== "all" || sort !== "index") && (
					<Link
						to="/browse"
						className="ml-auto text-[12px] text-white/55 hover:text-white"
						onClick={() => {
							setDraft("");
						}}
					>
						Clear
					</Link>
				)}
			</form>

			<div className="mt-7 flex items-baseline justify-between gap-4">
				<p className="text-[14px] text-white/68">
					{sorted.length.toLocaleString()} {sorted.length === 1 ? "record" : "records"}
					{query && <span className="text-white"> for “{query}”</span>}
				</p>
				{searching && (
					<p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
						prefix filters live: p: - c: - y:
					</p>
				)}
			</div>

			{error ? (
				<div className="panel mt-5 rounded-2xl p-8">
					<p className="text-[15px] text-white/80">The shared index could not be reached.</p>
					<p className="mt-2 max-w-[520px] break-words text-[12.5px] leading-relaxed text-white/58">{error}</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="mt-6 inline-flex h-9 items-center rounded-full border border-white/15 px-4 text-[12px] text-white/70 hover:border-white/35 hover:text-white"
					>
						Retry
					</button>
				</div>
			) : loading ? (
				<div className="mt-5 py-20 text-center text-[15px] text-white/65">Loading the shared index…</div>
			) : sorted.length === 0 ? (
				<div className="py-24 text-center">
					<p className="text-[16px] text-white/80">Nothing came up.</p>
					<Link
						to="/browse"
						className="mt-4 inline-block text-[13px] text-white/65 underline underline-offset-4 hover:text-white"
					>
						Start over
					</Link>
				</div>
			) : (
				<>
					<div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
						{shown.map((rom) => (
							<RomCard key={rom.id} view={romView(rom)} />
						))}
					</div>
					{visible < sorted.length && (
						<div className="mt-10 flex flex-col items-center gap-3">
							<button
								type="button"
								onClick={() => setVisible((value) => value + PAGE_SIZE)}
								className="inline-flex h-10 items-center rounded-full border border-white/[0.14] px-5 text-[12.5px] text-white/75 transition-colors hover:border-white/30 hover:text-white"
							>
								Show more
							</button>
							<p className="font-mono text-[11px] text-white/45">
								showing {shown.length.toLocaleString()} of {sorted.length.toLocaleString()}
							</p>
						</div>
					)}
				</>
			)}
		</div>
	);
}
