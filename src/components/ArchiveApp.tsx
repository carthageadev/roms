"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Layers, Loader2, Plus, RotateCcw, X } from "lucide-react";
import type { Game, Library, LibraryCollection } from "@/lib/types";
import { CollectionCard } from "./CollectionCard";
import { CollectionDetails } from "./CollectionDetails";
import { CollectionEditor, type CollectionInput } from "./CollectionEditor";
import { GameDetails } from "./GameDetails";
import { HomeHero } from "./HomeHero";
import { ZenGate } from "./ZenGate";

type View = "home" | "lists";

export function ArchiveApp({ initialGames }: { initialGames: Game[] }) {
  const [view, setView] = useState<View>("home");
  const [library, setLibrary] = useState<Library>({ savedGameIds: [], collections: [] });
  const [listedGames, setListedGames] = useState<Game[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryError, setLibraryError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<LibraryCollection | null>(null);
  const [editor, setEditor] = useState<{ collection?: LibraryCollection; gameId?: string } | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);

  const loadLibrary = useCallback(async () => {
    setLibraryError(false);
    try {
      const response = await fetch("/api/library", { cache: "no-store" });
      if (!response.ok) throw new Error("Lists unavailable");
      const data = (await response.json()) as Library & { games?: Game[] };
      setLibrary(data);
      setListedGames(Array.isArray(data.games) ? data.games : []);
      setLibraryReady(true);
    } catch {
      setLibraryError(true);
      setLibraryReady(false);
    }
  }, []);

  // Mount-only fetch: the lists load once, not derived from render state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);

  async function mutateLibrary(input: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your change could not be saved.");
      setLibrary(data as Library);
      return data as Library;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Please try again.", true);
      throw error;
    } finally {
      setBusy(false);
    }
  }

  function findKnownGame(id: string): Game | null {
    return listedGames.find((game) => game.id === id) ?? (selectedGame?.id === id ? selectedGame : null);
  }

  async function toggleSave(game: Game) {
    if (!libraryReady || busy) return;
    const wasSaved = library.savedGameIds.includes(game.id);
    try {
      const data = (await mutateLibrary({ action: "toggle-save", gameId: game.id })) as Library & { games?: Game[] };
      if (Array.isArray(data.games)) setListedGames(data.games);
      notify(wasSaved ? "Removed from your saved games" : "Saved. Keep the good ones close.");
    } catch {
      // The toast already reports the failure.
    }
  }

  async function submitCollection(input: CollectionInput) {
    try {
      const payload: Record<string, unknown> = { action: editor?.collection ? "update-collection" : "create-collection", collectionId: editor?.collection?.id, ...input };
      const data = (await mutateLibrary(payload)) as Library & { games?: Game[] };
      if (Array.isArray(data.games)) setListedGames(data.games);
      notify(editor?.collection ? "Your list, a little more you." : "Your new list is ready.");
      setEditor(null);
      setSelectedCollection(null);
      setView("lists");
    } catch {
      // Keep the editor open so the draft is not lost.
    }
  }

  async function deleteCollection() {
    if (!editor?.collection) return;
    try {
      await mutateLibrary({ action: "delete-collection", collectionId: editor.collection.id });
      setEditor(null);
      setSelectedCollection(null);
      notify("List deleted. Your saved games are still here.");
    } catch {
      // Keep the dialog open for a retry.
    }
  }

  async function toggleMembership(collectionId: string) {
    if (!selectedGame) return;
    const alreadyIn = library.collections.find((collection) => collection.id === collectionId)?.gameIds.includes(selectedGame.id);
    try {
      await mutateLibrary({ action: "toggle-collection-game", collectionId, gameId: selectedGame.id });
      notify(alreadyIn ? "Removed from the list" : "Added to the list. Good company.");
    } catch {
      // The toast already reports the failure.
    }
  }

  const allKnownGames = useMemo(() => {
    const map = new Map<string, Game>();
    for (const game of initialGames) map.set(game.id, game);
    for (const game of listedGames) map.set(game.id, game);
    return [...map.values()];
  }, [initialGames, listedGames]);

  const busyLibrary = busy || !libraryReady;

  function collectionGrid(items: LibraryCollection[], allowCreate = false) {
    return (
      <div className="collection-grid">
        {items.map((collection) => (
          <CollectionCard key={collection.id} collection={collection} games={allKnownGames} onOpen={() => setSelectedCollection(collection)} />
        ))}
        {allowCreate && items.length > 0 && (
          <button className="create-collection-card" onClick={() => setEditor({})} disabled={busyLibrary}>
            <span><Plus size={24} strokeWidth={1.3} /></span>
            <h3>A little room for more.</h3>
            <p>Create a new list</p>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`app-shell ${view === "home" ? "is-home" : ""}`}>
      <ZenGate view={view} listCount={library.collections.length} onNavigate={setView} />

      <main className="main-content">
        {view === "home" && <HomeHero />}

        {view === "lists" && (
          <>
            <section className="page-heading">
              <div>
                <span className="eyebrow">A QUIET SHELF OF YOUR OWN</span>
                <h1>Make a list.</h1>
                <p>Bring a few favorites together. A feeling, a theme, a Sunday afternoon.</p>
              </div>
              <button className="primary-button" disabled={busyLibrary} onClick={() => setEditor({})}>
                <Plus size={16} />New list
              </button>
            </section>

            {libraryError ? (
              <div className="empty-state main-empty">
                <AlertCircle size={32} />
                <h3>Your lists need a moment.</h3>
                <p>Nothing is lost. Please try connecting again.</p>
                <button className="secondary-button" onClick={() => void loadLibrary()}><RotateCcw size={15} />Try again</button>
              </div>
            ) : !libraryReady ? (
              <div className="library-loading"><Loader2 size={24} className="spin" /><p>Finding your lists…</p></div>
            ) : library.collections.length ? (
              collectionGrid(library.collections, true)
            ) : (
              <div className="empty-state main-empty">
                <Layers size={37} strokeWidth={1.1} />
                <h3>Nothing here yet.</h3>
                <p>Start a list. Add the games worth keeping together.</p>
                <button className="primary-button" onClick={() => setEditor({})} disabled={busyLibrary}>Create your first list<Plus size={16} /></button>
                <span className="empty-footnote">No sign-up. Just your own quiet corner.</span>
              </div>
            )}
          </>
        )}
      </main>

      {selectedGame && (
        <GameDetails
          game={selectedGame}
          saved={library.savedGameIds.includes(selectedGame.id)}
          collections={library.collections}
          busy={busyLibrary}
          onClose={() => setSelectedGame(null)}
          onSave={() => void toggleSave(selectedGame)}
          onToggleCollection={(id) => void toggleMembership(id)}
          onCreateCollection={() => { setEditor({ gameId: selectedGame.id }); setSelectedGame(null); }}
        />
      )}
      {selectedCollection && (
        <CollectionDetails
          collection={selectedCollection}
          games={allKnownGames}
          savedIds={library.savedGameIds}
          busy={busyLibrary}
          onClose={() => setSelectedCollection(null)}
          onSaveGame={toggleSave}
          onOpenGame={(game) => { setSelectedCollection(null); setSelectedGame(game); }}
          onClone={() => {}}
          onEdit={() => { setEditor({ collection: selectedCollection }); setSelectedCollection(null); }}
        />
      )}
      {editor && (
        <CollectionEditor
          games={allKnownGames}
          collection={editor.collection}
          initialGameId={editor.gameId}
          busy={busy}
          onClose={() => { if (!busy) setEditor(null); }}
          onSubmit={submitCollection}
          onDelete={deleteCollection}
        />
      )}

      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"}>
          {toast.error ? <AlertCircle size={17} /> : <span className="toast-check"><Check size={13} /></span>}
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
