import { useCallback, useSyncExternalStore } from "react";
import { getState, subscribe, type LibraryState } from "./library-store";

/** Subscribe to the localStorage-backed library store. */
export function useLibraryState(): LibraryState {
	return useSyncExternalStore(subscribe, getState, getState);
}

/** Stable callback that always sees the newest store value. */
export function useLibraryAction<A extends unknown[]>(action: (...args: A) => unknown) {
	return useCallback((...args: A) => action(...args), [action]);
}
