/**
 * Personal library + curated lists, stored entirely in localStorage.
 *
 * Design notes:
 *  - `rom.id` (string) is the stable key everywhere: saves, list items, exports.
 *  - The store is a tiny observable: `getState` / `subscribe` / `mutate`.
 *  - Cross-tab sync via the `storage` event so two open tabs never disagree.
 *  - Writes are versioned and validated on read so a stale or hand-edited
 *    payload can never crash the app.
 */

export type LibraryStatus = "saved" | "playing" | "completed" | "mastered";
export type ListPreset = "chromatic" | "silver" | "gold";

export const STATUS_KEYS: readonly LibraryStatus[] = ["playing", "saved", "completed", "mastered"];

export const LIST_PRESETS: readonly ListPreset[] = ["chromatic", "silver", "gold"];

export const NAME_MAX = 80;
export const NOTE_MAX = 280;
export const CURATOR_MAX = 60;
export const NOTES_MAX = 400;
export const CURATOR_NOTE_MAX = 280;

export interface SaveEntry {
	status: LibraryStatus;
	pinned: boolean;
	notes: string;
	createdAt: string;
	updatedAt: string;
}

export interface ListItem {
	romId: string;
	curatorNote: string;
	addedAt: string;
}

export interface ListCollection {
	id: string;
	name: string;
	note: string;
	curator: string;
	preset: ListPreset;
	createdAt: string;
	items: ListItem[];
}

export interface LibraryState {
	version: number;
	saves: Record<string, SaveEntry>;
	collections: ListCollection[];
}

const STORAGE_KEY = "roms.tn/library/v1";
const STATE_VERSION = 1;

const EMPTY: LibraryState = { version: STATE_VERSION, saves: {}, collections: [] };

function now(): string {
	return new Date().toISOString();
}

export function clamp(value: unknown, max: number): string {
	return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asText(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function isStatus(value: unknown): value is LibraryStatus {
	return value === "saved" || value === "playing" || value === "completed" || value === "mastered";
}

function isPreset(value: unknown): value is ListPreset {
	return value === "chromatic" || value === "silver" || value === "gold";
}

function normalizeSave(value: unknown, key: string): SaveEntry | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	const id = asText(raw.id ?? key).trim() || key.trim();
	if (!id) return null;
	const createdAt = asText(raw.createdAt) || now();
	return {
		status: isStatus(raw.status) ? raw.status : "saved",
		pinned: raw.pinned === true,
		notes: asText(raw.notes).slice(0, NOTES_MAX),
		createdAt,
		updatedAt: asText(raw.updatedAt) || createdAt,
	};
}

function normalizeItem(value: unknown): ListItem | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	const romId = asText(raw.romId ?? raw.rom_id ?? raw.gameId).trim();
	if (!romId) return null;
	return {
		romId,
		curatorNote: asText(raw.curatorNote).slice(0, CURATOR_NOTE_MAX),
		addedAt: asText(raw.addedAt) || now(),
	};
}

function normalizeCollection(value: unknown): ListCollection | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	const id = asText(raw.id).trim();
	if (!id) return null;
	const items = Array.isArray(raw.items) ? raw.items : [];
	const seen = new Set<string>();
	const normalizedItems: ListItem[] = [];
	for (const entry of items) {
		const item = normalizeItem(entry);
		if (!item || seen.has(item.romId)) continue;
		seen.add(item.romId);
		normalizedItems.push(item);
	}
	return {
		id,
		name: clamp(raw.name, NAME_MAX) || "Untitled list",
		note: asText(raw.note).slice(0, NOTE_MAX),
		curator: clamp(raw.curator, CURATOR_MAX),
		preset: isPreset(raw.preset) ? raw.preset : "chromatic",
		createdAt: asText(raw.createdAt) || now(),
		items: normalizedItems,
	};
}

function normalizeState(raw: unknown): LibraryState {
	if (!raw || typeof raw !== "object") return { ...EMPTY, saves: {}, collections: [] };
	const source = raw as Record<string, unknown>;
	const saves: Record<string, SaveEntry> = {};
	if (source.saves && typeof source.saves === "object") {
		for (const [key, value] of Object.entries(source.saves as Record<string, unknown>)) {
			const save = normalizeSave(value, key);
			if (save) saves[key] = save;
		}
	}
	const collections = (Array.isArray(source.collections) ? source.collections : [])
		.map(normalizeCollection)
		.filter((item): item is ListCollection => Boolean(item));
	return { version: STATE_VERSION, saves, collections };
}

function readStorage(): LibraryState {
	if (typeof localStorage === "undefined") return { ...EMPTY, saves: {}, collections: [] };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...EMPTY, saves: {}, collections: [] };
		return normalizeState(JSON.parse(raw));
	} catch {
		return { ...EMPTY, saves: {}, collections: [] };
	}
}

let state: LibraryState = readStorage();
const listeners = new Set<() => void>();
let applyingRemote = false;

function notify(): void {
	for (const listener of listeners) listener();
}

function persist(): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Quota or private-mode failures should never break the UI.
	}
}

function commit(next: LibraryState): void {
	state = next;
	persist();
	if (!applyingRemote) notify();
}

export function getState(): LibraryState {
	return state;
}

export function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

if (typeof window !== "undefined") {
	window.addEventListener("storage", (event) => {
		if (event.key !== null && event.key !== STORAGE_KEY) return;
		applyingRemote = true;
		try {
			state = readStorage();
			notify();
		} finally {
			applyingRemote = false;
		}
	});
}

function newId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	return `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function upsertSave(saves: Record<string, SaveEntry>, romId: string, patch: Partial<SaveEntry>): Record<string, SaveEntry> {
	const existing = saves[romId];
	const stamp = now();
	const next: SaveEntry = existing
		? { ...existing, ...patch, updatedAt: stamp }
		: { status: "saved", pinned: false, notes: "", createdAt: stamp, updatedAt: stamp, ...patch };
	return { ...saves, [romId]: next };
}

function withCollection(id: string, update: (collection: ListCollection) => ListCollection): ListCollection[] {
	return state.collections.map((collection) => (collection.id === id ? update(collection) : collection));
}

export function isSaved(romId: string): boolean {
	return Boolean(state.saves[romId]);
}

export function getSave(romId: string): SaveEntry | undefined {
	return state.saves[romId];
}

export function toggleSave(romId: string): boolean {
	if (!romId) return false;
	const saved = isSaved(romId);
	const saves = { ...state.saves };
	if (saved) delete saves[romId];
	else saves[romId] = { status: "saved", pinned: false, notes: "", createdAt: now(), updatedAt: now() };
	commit({ ...state, saves });
	return !saved;
}

export function saveRom(romId: string, status: LibraryStatus = "saved"): void {
	if (!romId) return;
	commit({ ...state, saves: upsertSave(state.saves, romId, { status }) });
}

export function setStatus(romId: string, status: LibraryStatus): void {
	if (!romId || !isStatus(status)) return;
	commit({ ...state, saves: upsertSave(state.saves, romId, { status }) });
}

export function setPinned(romId: string, pinned: boolean): void {
	if (!romId) return;
	commit({ ...state, saves: upsertSave(state.saves, romId, { pinned }) });
}

export function togglePinned(romId: string): void {
	if (!romId) return;
	commit({ ...state, saves: upsertSave(state.saves, romId, { pinned: !state.saves[romId]?.pinned }) });
}

export function setNotes(romId: string, notes: string): void {
	if (!romId) return;
	commit({ ...state, saves: upsertSave(state.saves, romId, { notes: asText(notes).slice(0, NOTES_MAX) }) });
}

export interface CreateListInput {
	name: string;
	note?: string;
	curator?: string;
	preset?: ListPreset;
	romIds?: string[];
}

export function createList(input: CreateListInput): string {
	const id = newId();
	const stamp = now();
	const romIds = (input.romIds ?? []).filter(Boolean);
	const items: ListItem[] = [];
	const seen = new Set<string>();
	for (const romId of romIds) {
		if (seen.has(romId)) continue;
		seen.add(romId);
		items.push({ romId, curatorNote: "", addedAt: stamp });
	}
	const collection: ListCollection = {
		id,
		name: clamp(input.name, NAME_MAX) || "Untitled list",
		note: asText(input.note).slice(0, NOTE_MAX),
		curator: clamp(input.curator, CURATOR_MAX),
		preset: isPreset(input.preset) ? input.preset : "chromatic",
		createdAt: stamp,
		items,
	};
	commit({ ...state, collections: [collection, ...state.collections] });
	return id;
}

export function deleteList(id: string): void {
	commit({ ...state, collections: state.collections.filter((collection) => collection.id !== id) });
}

export function updateList(
	id: string,
	patch: { name?: string; note?: string; curator?: string; preset?: ListPreset },
): void {
	const clean: Partial<ListCollection> = {};
	if (patch.name !== undefined) clean.name = clamp(patch.name, NAME_MAX) || "Untitled list";
	if (patch.note !== undefined) clean.note = asText(patch.note).slice(0, NOTE_MAX);
	if (patch.curator !== undefined) clean.curator = clamp(patch.curator, CURATOR_MAX);
	if (patch.preset !== undefined && isPreset(patch.preset)) clean.preset = patch.preset;
	commit({ ...state, collections: withCollection(id, (collection) => ({ ...collection, ...clean })) });
}

export function listContains(id: string, romId: string): boolean {
	const collection = state.collections.find((item) => item.id === id);
	return Boolean(collection?.items.some((item) => item.romId === romId));
}

export function toggleListItem(id: string, romId: string): boolean {
	if (!romId) return false;
	const collection = state.collections.find((item) => item.id === id);
	if (!collection) return false;
	const has = collection.items.some((item) => item.romId === romId);
	const items = has
		? collection.items.filter((item) => item.romId !== romId)
		: [...collection.items, { romId, curatorNote: "", addedAt: now() }];
	commit({ ...state, collections: withCollection(id, (item) => ({ ...item, items })) });
	return !has;
}

export function addListItem(id: string, romId: string): void {
	if (!romId || listContains(id, romId)) return;
	const collection = state.collections.find((item) => item.id === id);
	if (!collection) return;
	commit({
		...state,
		collections: withCollection(id, (item) => ({
			...item,
			items: [...item.items, { romId, curatorNote: "", addedAt: now() }],
		})),
	});
}

export function removeListItem(id: string, romId: string): void {
	if (!listContains(id, romId)) return;
	commit({
		...state,
		collections: withCollection(id, (item) => ({
			...item,
			items: item.items.filter((entry) => entry.romId !== romId),
		})),
	});
}

export function setCuratorNote(id: string, romId: string, curatorNote: string): void {
	commit({
		...state,
		collections: withCollection(id, (item) => ({
			...item,
			items: item.items.map((entry) =>
				entry.romId === romId ? { ...entry, curatorNote: asText(curatorNote).slice(0, CURATOR_NOTE_MAX) } : entry,
			),
		})),
	});
}

/** Move an item by one slot; the array order is the list order. */
export function moveListItem(id: string, romId: string, direction: "up" | "down"): void {
	const collection = state.collections.find((item) => item.id === id);
	if (!collection) return;
	const index = collection.items.findIndex((item) => item.romId === romId);
	if (index < 0) return;
	const target = direction === "up" ? index - 1 : index + 1;
	if (target < 0 || target >= collection.items.length) return;
	const items = [...collection.items];
	const [moved] = items.splice(index, 1);
	items.splice(target, 0, moved);
	commit({ ...state, collections: withCollection(id, (item) => ({ ...item, items })) });
}

export function getList(id: string): ListCollection | undefined {
	return state.collections.find((collection) => collection.id === id);
}

export function savedCount(): number {
	return Object.keys(state.saves).length;
}

export function clearAll(): void {
	commit({ ...EMPTY, version: STATE_VERSION });
}
