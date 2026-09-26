import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadRomIndex, type AtlasMeta, type RomEntry } from "./roms";
import { buildRomIndexView, type RomIndexView } from "./rom-view";

/** The shared index lives behind this host; the site never bundles a ROM list. */
export const DATA_SOURCE_HOST = "http://92.35.124.13";

export interface RomIndexState {
	loading: boolean;
	error: string | null;
	status: string;
	/** "new data fetched from source" or "cached data loaded - no new index update" */
	sourceLabel: string;
	meta: AtlasMeta | null;
	view: RomIndexView;
	total: number;
}

const EMPTY_VIEW: RomIndexView = { byId: new Map(), bySlug: new Map(), views: [], roms: [] };

const RomIndexContext = createContext<RomIndexState | null>(null);

export function RomIndexProvider({ children }: { children: ReactNode }) {
	const [roms, setRoms] = useState<RomEntry[]>([]);
	const [meta, setMeta] = useState<AtlasMeta | null>(null);
	const [status, setStatus] = useState("connecting to data index");
	const [sourceLabel, setSourceLabel] = useState("fetching new data index");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		loadRomIndex((message) => {
			if (!cancelled) setStatus(message);
		})
			.then((index) => {
				if (cancelled) return;
				setRoms(index.roms);
				setMeta(index.meta);
				setSourceLabel(
					index.source === "cache"
						? "cached data loaded - no new index update"
						: "new data fetched from source",
				);
				setStatus("index ready - data loaded");
			})
			.catch((loadFailure: unknown) => {
				if (cancelled) return;
				setError(loadFailure instanceof Error ? loadFailure.message : String(loadFailure));
				setStatus("data index unavailable");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const value = useMemo<RomIndexState>(() => {
		const view = roms.length ? buildRomIndexView(roms) : EMPTY_VIEW;
		return {
			loading,
			error,
			status,
			sourceLabel,
			meta,
			view,
			total: view.roms.length,
		};
	}, [error, loading, meta, roms, sourceLabel, status]);

	return <RomIndexContext.Provider value={value}>{children}</RomIndexContext.Provider>;
}

export function useRomIndex(): RomIndexState {
	const context = useContext(RomIndexContext);
	if (!context) throw new Error("useRomIndex must be used inside RomIndexProvider");
	return context;
}
