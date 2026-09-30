"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Search, Bookmark, Plus, SlidersHorizontal, ChevronDown, X, Leaf, Layers, ArrowUp, Menu, Check, AlertCircle, Heart, Loader2, RotateCcw } from "lucide-react";
import { MetalFx } from "./MetalFx";
import { CURATED_COLLECTIONS } from "@/lib/catalog";
import type { Game, Library, LibraryCollection, CuratedCollection } from "@/lib/types";
import { GameCard } from "./GameCard";
import { CollectionCard } from "./CollectionCard";
import { Modal } from "./Modal";
import { GameDetails } from "./GameDetails";
import { CollectionDetails } from "./CollectionDetails";
import { CollectionEditor, type CollectionInput } from "./CollectionEditor";
import { PlatformIcon } from "./PlatformIcon";

type View = "discover" | "platforms" | "collections" | "library";
const PLATFORM_TABS = [{ id: "all", label: "All platforms" }, { id: "nintendo", label: "Nintendo" }, { id: "playstation", label: "PlayStation" }, { id: "gameboy", label: "Game Boy" }, { id: "sega", label: "Sega" }];
const PLATFORMS = [
  { id: "n64", name: "Nintendo 64", era: "1996–2002", color: "#e5e9df", line: "A whole new dimension." },
  { id: "snes", name: "Super Nintendo", era: "1990–2003", color: "#e9e5ed", line: "The golden age of 16-bit." },
  { id: "gba", name: "Game Boy Advance", era: "2001–2010", color: "#e3e9df", line: "Big adventures. Small pockets." },
  { id: "gb", name: "Game Boy", era: "1989–2003", color: "#e8eadc", line: "Wherever you went, play followed." },
  { id: "ps1", name: "PlayStation", era: "1994–2006", color: "#e2e8ed", line: "Greatness had to start somewhere." },
  { id: "genesis", name: "Sega Genesis", era: "1988–1997", color: "#eee4df", line: "A little attitude. A lot of heart." },
];

function Brand({ onClick }: { onClick: () => void }) {
  return <button className="brand" onClick={onClick} aria-label="roms.tn home"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>roms<span className="brand-domain">.tn</span></span></button>;
}

export function ArchiveApp({ initialGames }: { initialGames: Game[] }) {
  const [view, setView] = useState<View>("discover");
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [genre, setGenre] = useState("all");
  const [decade, setDecade] = useState("all");
  const [sort, setSort] = useState("featured");
  const [results, setResults] = useState(initialGames);
  const [requestLoading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [library, setLibrary] = useState<Library>({ savedGameIds: [], collections: [] });
  const [keptGames, setKeptGames] = useState<Game[]>([]);
  const [realResults, setRealResults] = useState<Game[]>([]);
  const [realTotal, setRealTotal] = useState(0);
  const [realLoading, setRealLoading] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryError, setLibraryError] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"games" | "collections">("games");
  const [collectionTab, setCollectionTab] = useState<"curated" | "mine">("curated");
  const [busy, setBusy] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<LibraryCollection | CuratedCollection | null>(null);
  const [editor, setEditor] = useState<{ collection?: LibraryCollection; gameId?: string } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const firstSearch = useRef(true);
  const filterPanel = useRef<HTMLDivElement>(null);

  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  const loadLibrary = useCallback(async () => {
    setLibraryError(false);
    try {
      const response = await fetch("/api/library", { cache: "no-store" });
      if (!response.ok) throw new Error("Library unavailable");
      const data = (await response.json()) as Library & { games?: Game[] };
      setLibrary(data);
      setKeptGames(Array.isArray(data.games) ? data.games : []);
      setLibraryReady(true);
    } catch { setLibraryError(true); setLibraryReady(false); }
  }, []);

  // Mount-only fetch: the library loads once, not derived from render state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadLibrary(); }, [loadLibrary]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Mount-only environment read for the reduced-motion preference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(media.matches);
    const change = () => setReducedMotion(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (firstSearch.current) { firstSearch.current = false; return; }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const params = new URLSearchParams({ q: query, platform, genre, decade, sort });
        const response = await fetch(`/api/games?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Search unavailable");
        setResults(data.games);
        setSettledQuery(query);
      } catch (error) {
        if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, query ? 220 : 0);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query, platform, genre, decade, sort, refresh]);
  useEffect(() => {
    // Reset the real-index panel when there is nothing to search for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view !== "discover" || !query.trim()) { setRealResults([]); setRealTotal(0); setRealLoading(false); return; }
    const controller = new AbortController();
    setRealLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/roms?${new URLSearchParams({ q: query.trim(), limit: "12" })}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Full index unavailable");
        if (!controller.signal.aborted) { setRealResults(data.games ?? []); setRealTotal(data.total ?? 0); }
      } catch {
        if (!controller.signal.aborted) { setRealResults([]); setRealTotal(0); }
      } finally { if (!controller.signal.aborted) setRealLoading(false); }
    }, 320);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query, view, refresh]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const inField = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") || (event.key === "/" && !inField)) {
        if (selectedGame || selectedCollection || editor || aboutOpen) return;
        event.preventDefault();
        if (view !== "discover" && view !== "library") setView("discover");
        setTimeout(() => { searchInput.current?.focus(); searchInput.current?.select(); }, 40);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [view, selectedGame, selectedCollection, editor, aboutOpen]);
  useEffect(() => {
    if (!filtersOpen) return;
    const close = (event: MouseEvent) => { if (!filterPanel.current?.contains(event.target as Node)) setFiltersOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filtersOpen]);

  function navigate(next: View) {
    setView(next); setMobileOpen(false); setFiltersOpen(false); setQuery(""); setPlatform("all"); setGenre("all"); setDecade("all"); setSort("featured"); setExpanded(false); setSearchError("");
    if (next === "library") setLibraryTab("games");
    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
  }
  function applyPlatform(id: string) {
    setView("discover"); setQuery(""); setPlatform(id); setExpanded(true); setFiltersOpen(false);
    setTimeout(() => document.getElementById("platform-filter")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" }), 60);
  }
  function clearFilters() { setQuery(""); setPlatform("all"); setGenre("all"); setDecade("all"); setExpanded(false); }
  function submitSearch(event: FormEvent) {
    event.preventDefault(); setExpanded(true);
    document.getElementById("archive")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
    searchInput.current?.blur();
  }
  async function mutateLibrary(input: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your change could not be saved.");
      setLibrary(data as Library);
      return data as Library;
    } catch (error) { notify(error instanceof Error ? error.message : "Please try again.", true); throw error; }
    finally { setBusy(false); }
  }
  function romPayload(game: Game) {
    return { id: game.id, title: game.title, platform: game.platform, platformName: game.platformName, year: game.year, genre: game.genre, developer: game.developer, description: game.description, color: game.color, accent: game.accent };
  }
  function findKnownGame(id: string): Game | null {
    return realResults.find((game) => game.id === id) ?? keptGames.find((game) => game.id === id) ?? (selectedGame?.id === id ? selectedGame : null);
  }
  async function toggleSave(game: Game) {
    if (!libraryReady || busy) return;
    const wasSaved = library.savedGameIds.includes(game.id);
    const input: Record<string, unknown> = game.id.startsWith("rom-") ? { action: "toggle-save", gameId: game.id, game: romPayload(game) } : { action: "toggle-save", gameId: game.id };
    try {
      const data = (await mutateLibrary(input)) as Library & { game?: Game };
      if (data.game) {
        const kept = data.game;
        setKeptGames((current) => (current.some((item) => item.id === kept.id) ? current.map((item) => (item.id === kept.id ? kept : item)) : [...current, kept]));
        setRealResults((current) => current.map((item) => (item.id === kept.id ? kept : item)));
        if (selectedGame?.id === kept.id) setSelectedGame(kept);
      }
      notify(wasSaved ? "Removed from your saved games" : "A good game, kept close. Saved to your library.");
    } catch { /* The library service displays a recoverable error. */ }
  }
  async function submitCollection(input: CollectionInput) {
    try {
      const payload: Record<string, unknown> = { action: editor?.collection ? "update-collection" : "create-collection", collectionId: editor?.collection?.id, ...input };
      const romGame = editor?.gameId && editor.gameId.startsWith("rom-") ? findKnownGame(editor.gameId) : null;
      await mutateLibrary(romGame ? { ...payload, games: [romPayload(romGame)] } : payload);
      notify(editor?.collection ? "Your collection, a little more you." : "Your new collection is ready.");
      setEditor(null); setSelectedCollection(null); navigate("library"); setLibraryTab("collections");
    } catch { /* Keep the editor open so the draft is not lost. */ }
  }
  async function deleteCollection() {
    if (!editor?.collection) return;
    try { await mutateLibrary({ action: "delete-collection", collectionId: editor.collection.id }); setEditor(null); setSelectedCollection(null); notify("Collection deleted. Your saved games are still here."); } catch { /* Keep the dialog open for a retry. */ }
  }
  async function cloneCollection() {
    if (!selectedCollection) return;
    const existing = library.collections.find((collection) => collection.name === selectedCollection.name && collection.gameIds.length === selectedCollection.gameIds.length && collection.gameIds.every((id) => selectedCollection.gameIds.includes(id)));
    if (existing) { setSelectedCollection(existing); notify("This collection is already yours."); return; }
    try {
      const data = await mutateLibrary({ action: "create-collection", name: selectedCollection.name, description: selectedCollection.description, color: selectedCollection.color, gameIds: selectedCollection.gameIds });
      setSelectedCollection(data.collections[0]); notify("Made it yours. Find it in your library.");
    } catch { /* Allow another attempt. */ }
  }
  async function toggleMembership(collectionId: string) {
    if (!selectedGame) return;
    const alreadyIn = library.collections.find((collection) => collection.id === collectionId)?.gameIds.includes(selectedGame.id);
    try {
      const input: Record<string, unknown> = selectedGame.id.startsWith("rom-")
        ? { action: "toggle-collection-game", collectionId, gameId: selectedGame.id, game: romPayload(selectedGame) }
        : { action: "toggle-collection-game", collectionId, gameId: selectedGame.id };
      await mutateLibrary(input); notify(alreadyIn ? "Removed from the collection" : "Added to the collection. Good company.");
    } catch { /* Allow another attempt. */ }
  }

  const hasFilters = !!query.trim() || platform !== "all" || genre !== "all" || decade !== "all";
  const queryPending = !searchError && query !== settledQuery;
  const loading = !searchError && (requestLoading || queryPending);
  const additionalFilters = Number(genre !== "all") + Number(decade !== "all");
  const allKnownGames = useMemo(() => {
    const map = new Map<string, Game>();
    for (const game of initialGames) map.set(game.id, game);
    for (const game of keptGames) map.set(game.id, game);
    for (const game of realResults) if (!map.has(game.id)) map.set(game.id, game);
    return [...map.values()];
  }, [initialGames, keptGames, realResults]);
  const displayed = view === "library" ? keptGames.filter((game) => `${game.title} ${game.platformName}`.toLowerCase().includes(query.trim().toLowerCase())) : queryPending ? results.slice(0, 4) : expanded || hasFilters ? results : results.slice(0, 4);
  const exactPlatform = PLATFORMS.find((item) => item.id === platform);
  const activeCollection = selectedCollection && !selectedCollection.id.startsWith("curated-") ? library.collections.find((collection) => collection.id === selectedCollection.id) ?? selectedCollection : selectedCollection;
  const busyLibrary = busy || !libraryReady;

  function searchBox(compact = false) {
    return <form className={`search-box ${compact ? "compact-search" : ""}`} onSubmit={submitSearch} role="search"><Search size={19} strokeWidth={1.6} /><input ref={searchInput} value={query} onChange={(event) => { setQuery(event.target.value); setExpanded(true); }} placeholder={view === "library" ? "Search your saved games…" : "Find your next old favorite…"} aria-label={view === "library" ? "Search saved games" : "Search games"} autoComplete="off" />{query ? <button type="button" className="search-clear" onClick={() => { setQuery(""); searchInput.current?.focus(); }} aria-label="Clear search"><X size={15} /></button> : <kbd>⌘ K</kbd>}<MetalFx preset="chromatic" variant="circle" strength={1} theme="light" paused={reducedMotion} className="search-metal"><button type="submit" className="search-submit" aria-label="Search the archive"><ArrowRight size={19} strokeWidth={1.7} /></button></MetalFx></form>;
  }

  function collectionGrid(items: (LibraryCollection | CuratedCollection)[], allowCreate = false) {
    return <div className="collection-grid">{items.map((collection) => <CollectionCard key={collection.id} collection={collection} games={allKnownGames} onOpen={() => setSelectedCollection(collection)} />)}{allowCreate && items.length > 0 && <button className="create-collection-card" onClick={() => setEditor({})} disabled={busyLibrary}><span><Plus size={24} strokeWidth={1.3} /></span><h3>A little room for more.</h3><p>Create a new collection</p></button>}</div>;
  }

  function libraryEmpty(kind: "games" | "collections") {
    return <div className="empty-state main-empty">{kind === "games" ? <Bookmark size={37} strokeWidth={1.1} /> : <Layers size={37} strokeWidth={1.1} />}<h3>{kind === "games" ? "Your next favorite is out there." : "A little shelf of your own."}</h3><p>{kind === "games" ? "Save the games that mean something to you. They’ll be right here." : "Bring your favorites together. A feeling, a theme, a Sunday afternoon."}</p><MetalFx preset="chromatic" strength={1} theme="light" paused={reducedMotion}><button className="primary-button" onClick={() => kind === "games" ? navigate("discover") : setEditor({})} disabled={kind === "collections" && busyLibrary}>{kind === "games" ? "Discover some classics" : "Create your first collection"}<ArrowRight size={16} /></button></MetalFx><span className="empty-footnote">No sign-up. Just your own quiet corner.</span></div>;
  }

  return <div className="app-shell"><header className="site-header"><div className="header-inner"><Brand onClick={() => navigate("discover")} /><nav className="main-nav" aria-label="Main navigation">{(["discover", "platforms", "collections"] as const).map((item) => <button key={item} className={`nav-link ${view === item ? "active" : ""}`} onClick={() => navigate(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav><div className="header-actions"><MetalFx preset="chromatic" strength={1} theme="light" paused={reducedMotion}><button className={`library-button ${view === "library" ? "active" : ""}`} onClick={() => navigate("library")}><Bookmark size={16} strokeWidth={1.7} /><span>Your library</span>{library.savedGameIds.length > 0 && <span className="library-count">{library.savedGameIds.length}</span>}</button></MetalFx><span className="header-divider" /><button className="profile-button" onClick={() => { navigate("library"); setLibraryTab("collections"); }} aria-label="Open your personal collections">r.</button><button className="mobile-menu-button icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button></div></div>{mobileOpen && <nav className="mobile-nav" aria-label="Mobile navigation">{(["discover", "platforms", "collections"] as const).map((item) => <button key={item} onClick={() => navigate(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav>}</header>

    <main className="main-content">
      {view === "discover" && <section className="hero" aria-labelledby="hero-heading"><div className="hero-visual"><Image src="/images/handheld.jpg" alt="A sculptural silver Game Boy floating over a soft sage background" fill priority sizes="(max-width: 700px) 100vw, 650px" /><div className="hero-image-fade" /><button className="hero-caption" onClick={() => applyPlatform("gb")}><span className="caption-line" />GAME BOY <span className="caption-dot">·</span> 1989 <ArrowUpRight size={13} /></button></div><div className="hero-copy"><div className="hero-eyebrow"><span className="live-dot" />THE PAST, PLAYED FORWARD</div><h1 id="hero-heading">Good games.<br /><span>Never forgotten.</span></h1><p>Rediscover the classics. Save your favorites.<br />A little nostalgia, a collection of your own.</p>{searchBox()}<div className="search-suggestions"><span>A little inspiration:</span>{["Zelda", "Pokémon", "Mario"].map((term) => <button key={term} onClick={() => { setQuery(term); setExpanded(true); }}>{term}<ArrowUpRight size={10} /></button>)}</div></div><span className="hero-edition">THE ORIGINALS NEVER GET OLD.</span></section>}

      {view === "platforms" && <><section className="page-heading"><div><span className="eyebrow">SIX LITTLE TIME MACHINES</span><h1>Different consoles. Same magic.</h1><p>Find the worlds you grew up with—and a few you might have missed.</p></div><button className="secondary-button" onClick={() => navigate("discover")}>Browse every game <ArrowRight size={16} /></button></section><div className="platform-grid">{PLATFORMS.map((item) => <button className="platform-card" key={item.id} onClick={() => applyPlatform(item.id)} style={{ background: item.color }}><div className="platform-card-top"><span className="platform-card-icon"><PlatformIcon platform={item.id} size={31} /></span><ArrowUpRight size={20} strokeWidth={1.3} /></div><span className="platform-era">{item.era}</span><h2>{item.name}</h2><p>{item.line}</p><span className="platform-game-count">{initialGames.filter((game) => game.platform === item.id).length} classics in the archive</span></button>)}</div></>}

      {view === "collections" && <><section className="page-heading"><div><span className="eyebrow">GOOD GAMES, BETTER TOGETHER</span><h1>A collection tells a story.</h1><p>A place for the games you love, and the ones you’re about to.</p></div><MetalFx preset="chromatic" strength={1} theme="light" paused={reducedMotion}><button className="primary-button" disabled={busyLibrary} onClick={() => setEditor({})}><Plus size={16} />New collection</button></MetalFx></section><div className="content-tabs"><button className={collectionTab === "curated" ? "active" : ""} onClick={() => setCollectionTab("curated")}>Curated with care <span>{CURATED_COLLECTIONS.length}</span></button><button className={collectionTab === "mine" ? "active" : ""} onClick={() => setCollectionTab("mine")}>Made by you <span>{library.collections.length}</span></button></div>{collectionTab === "curated" ? collectionGrid(CURATED_COLLECTIONS) : library.collections.length ? collectionGrid(library.collections, true) : libraryEmpty("collections")}</>}

      {view === "library" && <><section className="page-heading library-heading"><div><span className="eyebrow">YOUR OWN QUIET CORNER</span><h1>Keep the good games close.</h1><p>A few old friends. A few new favorites. Entirely yours.</p></div><MetalFx preset="chromatic" strength={1} theme="light" paused={reducedMotion}><button className="primary-button" disabled={busyLibrary} onClick={() => setEditor({})}><Plus size={16} />New collection</button></MetalFx></section><div className="content-tabs"><button className={libraryTab === "games" ? "active" : ""} onClick={() => setLibraryTab("games")}><Bookmark size={15} />Saved games <span>{library.savedGameIds.length}</span></button><button className={libraryTab === "collections" ? "active" : ""} onClick={() => setLibraryTab("collections")}><Layers size={15} />Collections <span>{library.collections.length}</span></button><span className="private-library-note"><span className="live-dot" />Private. Just for you.</span></div>{libraryError ? <div className="empty-state main-empty"><AlertCircle size={32} /><h3>Your library needs a moment.</h3><p>Nothing is lost. Please try connecting again.</p><button className="secondary-button" onClick={() => void loadLibrary()}><RotateCcw size={15} />Try again</button></div> : !libraryReady ? <div className="library-loading"><Loader2 size={24} className="spin" /><p>Finding your favorites…</p></div> : libraryTab === "collections" ? library.collections.length ? collectionGrid(library.collections, true) : libraryEmpty("collections") : library.savedGameIds.length === 0 ? libraryEmpty("games") : <div className="library-search-row">{searchBox(true)}</div>}</>}

      {view === "discover" && <div className="platform-filter" id="platform-filter"><div className="platform-tabs" role="group" aria-label="Filter by platform">{PLATFORM_TABS.map((item) => <button key={item.id} className={`platform-tab ${platform === item.id ? "active" : ""}`} onClick={() => { setPlatform(item.id); setExpanded(item.id !== "all"); }} aria-pressed={platform === item.id}><PlatformIcon platform={item.id} /><span>{item.label}</span>{item.id === "all" && <span className="tab-count">{initialGames.length}</span>}</button>)}</div><div className="filters-control" ref={filterPanel}><button className={`filter-button ${filtersOpen || additionalFilters ? "active" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}><SlidersHorizontal size={15} strokeWidth={1.6} />Filters{additionalFilters > 0 && <span>{additionalFilters}</span>}</button>{filtersOpen && <div className="filter-popover"><div className="filter-popover-heading"><h3>Your kind of game.</h3><button className="icon-button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={16} /></button></div><label>Genre<select value={genre} onChange={(event) => { setGenre(event.target.value); setExpanded(true); }}><option value="all">Every kind of adventure</option>{["Adventure", "RPG", "Platformer", "Puzzle", "Action"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Era<select value={decade} onChange={(event) => { setDecade(event.target.value); setExpanded(true); }}><option value="all">Any time, any memory</option><option value="1980">The 1980s</option><option value="1990">The 1990s</option><option value="2000">The 2000s</option></select></label><div className="filter-popover-footer"><button className="text-button" onClick={() => { setGenre("all"); setDecade("all"); }}>Reset filters</button><button className="primary-button small-button" onClick={() => setFiltersOpen(false)}>Done <Check size={14} /></button></div></div>}</div></div>}

      {(view === "discover" || (view === "library" && libraryReady && !libraryError && libraryTab === "games" && library.savedGameIds.length > 0)) && <section className={`archive-section ${view === "library" ? "library-archive" : ""}`} id="archive" aria-busy={loading}><div className="section-heading"><div><h2>{query.trim() ? `Results for “${query.trim()}”` : view === "library" ? "Saved for a rainy day." : exactPlatform ? `${exactPlatform.name}, rediscovered.` : hasFilters ? "Good games, your way." : "Your next old favorite."}</h2><p aria-live="polite">{loading ? "Looking through the archive…" : query.trim() || hasFilters ? `${displayed.length} ${displayed.length === 1 ? "classic" : "classics"} to rediscover.` : view === "library" ? "Good memories, all in one place." : "Timeless for a reason. Here are a few we love."}</p></div><div className="archive-tools">{hasFilters && <button className="clear-filter-button" onClick={clearFilters}>Clear filters <X size={13} /></button>}<label className="sort-control"><span className="sr-only">Sort games</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Popular picks</option><option value="az">A to Z</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDown size={14} /></label></div></div>{searchError ? <div className="search-error"><AlertCircle size={20} /><p>{searchError}</p><button className="text-button" onClick={() => setRefresh((current) => current + 1)}>Try again <RotateCcw size={14} /></button></div> : displayed.length ? <div className={`game-grid ${loading ? "is-loading" : ""}`}>{displayed.map((game) => <GameCard key={game.id} game={game} saved={library.savedGameIds.includes(game.id)} disabled={busyLibrary} onSave={toggleSave} onOpen={setSelectedGame} />)}</div> : <div className="empty-state search-empty"><Search size={34} strokeWidth={1.2} /><h3>{loading ? "Looking through the archive…" : "A different adventure, perhaps?"}</h3><p>{loading ? "Good games are worth a little patience." : "No games match that search. Try a title, a genre, or another platform."}</p>{!loading && <button className="secondary-button" onClick={clearFilters}>Explore all games <ArrowRight size={15} /></button>}</div>}{view === "discover" && !expanded && !hasFilters && results.length > 4 && <div className="browse-more"><button className="browse-button" onClick={() => setExpanded(true)}>Explore all {initialGames.length} games <ArrowRight size={16} /><span className="browse-dot" /></button></div>}{view === "discover" && expanded && !hasFilters && <div className="archive-end"><span className="live-dot" />{initialGames.length} classics. Countless memories.<button onClick={() => { setExpanded(false); document.getElementById("archive")?.scrollIntoView({ behavior: "smooth" }); }}>Show the highlights <ArrowUp size={12} /></button></div>}</section>}

      {view === "discover" && query.trim() !== "" && <section className="archive-section real-index" id="real-index" aria-busy={realLoading}><div className="section-heading"><div><span className="eyebrow">BEYOND THE SHELF</span><h2>From the full index.</h2><p aria-live="polite">{realLoading ? "Searching every record…" : realTotal === 0 ? "Nothing in the full index for that name." : `${realTotal.toLocaleString()} ${realTotal === 1 ? "record" : "records"} in the full index. Save one to fetch its cover.`}</p></div></div>{realResults.length > 0 && <div className="game-grid">{realResults.map((game) => <GameCard key={game.id} game={game} saved={library.savedGameIds.includes(game.id)} disabled={busyLibrary} onSave={toggleSave} onOpen={setSelectedGame} />)}</div>}</section>}

      {view === "discover" && !hasFilters && <section className="curated-section"><div className="section-heading"><div><span className="eyebrow">A LITTLE CURATION GOES A LONG WAY</span><h2>Better together.</h2><p>Good games. A common thread. Your next rabbit hole.</p></div><button className="text-button section-link" onClick={() => navigate("collections")}>All collections <ArrowUpRight size={16} /></button></div>{collectionGrid(CURATED_COLLECTIONS)}</section>}

      <section className="mission-strip"><span className="mission-icon"><Heart size={22} strokeWidth={1.3} /></span><div><h3>More than games. A little piece of us.</h3><p>For the worlds we grew up in, and the memories worth keeping.</p></div><button className="text-button" onClick={() => setAboutOpen(true)}>Our little mission <ArrowUpRight size={16} /></button></section>
    </main>

    <footer className="site-footer"><div className="footer-top"><div><Brand onClick={() => navigate("discover")} /><p>Made for the love of the game.</p></div><div className="footer-links"><button onClick={() => setAboutOpen(true)}>About the archive</button><button onClick={() => setAboutOpen(true)}><Leaf size={13} />Preservation matters</button><button onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" })}>Back to top <ArrowUp size={13} /></button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} roms.tn. The past, played forward.</span><span>An independent archive. No ROM files hosted.<span className="footer-dot" /></span></div></footer>

    {selectedGame && <GameDetails game={selectedGame} saved={library.savedGameIds.includes(selectedGame.id)} collections={library.collections} busy={busyLibrary} onClose={() => setSelectedGame(null)} onSave={() => void toggleSave(selectedGame)} onToggleCollection={(id) => void toggleMembership(id)} onCreateCollection={() => { setEditor({ gameId: selectedGame.id }); setSelectedGame(null); }} />}
    {activeCollection && <CollectionDetails collection={activeCollection} games={allKnownGames} savedIds={library.savedGameIds} busy={busyLibrary} onClose={() => setSelectedCollection(null)} onSaveGame={toggleSave} onOpenGame={(game) => { setSelectedCollection(null); setSelectedGame(game); }} onClone={() => void cloneCollection()} onEdit={() => { setEditor({ collection: activeCollection }); setSelectedCollection(null); }} />}
    {editor && <CollectionEditor games={allKnownGames} collection={editor.collection} initialGameId={editor.gameId} busy={busy} onClose={() => { if (!busy) setEditor(null); }} onSubmit={submitCollection} onDelete={deleteCollection} />}
    {aboutOpen && <Modal title="The roms.tn mission" onClose={() => setAboutOpen(false)} className="about-modal"><span className="about-icon"><Leaf size={29} strokeWidth={1.2} /></span><span className="eyebrow">A SMALL ARCHIVE. A LASTING LOVE.</span><h2>The past deserves<br />a future.</h2><p>Some games stay with us. A song, a color, that first step into a world that felt bigger than the room we were in.</p><p>roms.tn is a quiet place to rediscover those worlds. We document the classics, curate the good stuff, and give you a little corner to keep your favorites together.</p><div className="about-stats"><div><strong>{initialGames.length}</strong><span>hand-picked classics</span></div><div><strong>{PLATFORMS.length}</strong><span>iconic platforms</span></div><div><Heart size={25} strokeWidth={1.3} /><span>one shared love</span></div></div><div className="about-note"><h3>Your library is yours.</h3><p>No sign-up and no public profile. Your private library is linked to this browser’s cookie; keeping it keeps your collection accessible.</p><h3>Preservation with respect.</h3><p>We don’t host or distribute ROM files. Box art and games belong to their respective creators. This independent project isn’t affiliated with Nintendo, Sony, Sega, or their publishers.</p></div><button className="primary-button" onClick={() => { setAboutOpen(false); navigate("discover"); }}>Find an old favorite <ArrowRight size={16} /></button></Modal>}
    {toast && <div className={`toast ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.error ? <AlertCircle size={17} /> : <span className="toast-check"><Check size={13} /></span>}<span>{toast.text}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}
  </div>;
}
