import { useEffect, useState } from "react";
import {
	type AtlasMeta,
	loadAtlasIndex,
	type RomEntry,
} from "../lib/atlas";

interface AtlasState {
	meta: AtlasMeta | null;
	docs: RomEntry[];
	companies: string[];
	consoles: string[];
	base: string;
	loading: boolean;
	progress: string;
	error: string | null;
}

type IndexResult = {
	meta: AtlasMeta | null;
	docs: RomEntry[];
	base: string;
};

// Module-level cache so StrictMode double-mount / multi-page doesn't refetch 7MB.
let inflight: Promise<IndexResult> | null = null;
const progressListeners = new Set<(t: string) => void>();

function getIndex(onProgress?: (t: string) => void): Promise<IndexResult> {
	if (onProgress) progressListeners.add(onProgress);
	if (!inflight) {
		inflight = loadAtlasIndex((t) => {
			for (const fn of progressListeners) {
				try {
					fn(t);
				} catch {
					/* ignore */
				}
			}
		}).catch((e) => {
			inflight = null;
			throw e;
		});
	}
	return inflight;
}

function releaseProgress(fn?: (t: string) => void) {
	if (fn) progressListeners.delete(fn);
}

export function useAtlasData(): AtlasState {
	const [state, setState] = useState<AtlasState>({
		meta: null,
		docs: [],
		companies: [],
		consoles: [],
		base: "",
		loading: true,
		progress: "Starting…",
		error: null,
	});

	useEffect(() => {
		let cancelled = false;
		const onProgress = (t: string) => {
			if (!cancelled) setState((s) => (s.loading ? { ...s, progress: t } : s));
		};
		getIndex(onProgress)
			.then(({ meta, docs, base }) => {
				if (cancelled) return;
				const companies =
					meta?.companies ?? [...new Set(docs.map((d) => d.company))].sort();
				const consoles =
					meta?.consoles ?? [...new Set(docs.map((d) => d.console))].sort();
				setState({
					meta,
					docs,
					companies,
					consoles,
					base,
					loading: false,
					progress: "",
					error: null,
				});
			})
			.catch((e: unknown) => {
				if (cancelled) return;
				setState((s) => ({
					...s,
					loading: false,
					progress: "",
					error: e instanceof Error ? e.message : String(e),
				}));
			})
			.finally(() => {
				releaseProgress(onProgress);
			});
		return () => {
			cancelled = true;
			releaseProgress(onProgress);
		};
	}, []);

	return state;
}
