/**
 * IndexedDB blob cache for cartridge label art. Origin-scoped and
 * persistent: once an image has been downloaded it is stored here,
 * keyed per game, and every later visit loads it locally.
 */

const DB_NAME = "roms-tn-art";
const STORE = "label-art";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

const db = () => (dbPromise ??= openDb());

export async function getCachedArt(key: string): Promise<Blob | null> {
	try {
		const d = await db();
		return await new Promise((resolve, reject) => {
			const req = d.transaction(STORE, "readonly").objectStore(STORE).get(key);
			req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
			req.onerror = () => reject(req.error);
		});
	} catch {
		return null; // cache is best-effort; fall back to the network
	}
}

export async function putCachedArt(key: string, blob: Blob): Promise<void> {
	try {
		const d = await db();
		await new Promise((resolve, reject) => {
			const req = d
				.transaction(STORE, "readwrite")
				.objectStore(STORE)
				.put(blob, key);
			req.onsuccess = () => resolve(undefined);
			req.onerror = () => reject(req.error);
		});
	} catch {
		/* best-effort */
	}
}
