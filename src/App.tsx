import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Footer, ZenNav } from "./components/nav";
import { DATA_SOURCE_HOST, RomIndexProvider, useRomIndex } from "./lib/rom-index-context";
import BrowsePage from "./pages/BrowsePage";
import CollectionDetailPage from "./pages/CollectionDetailPage";
import CollectionsPage from "./pages/CollectionsPage";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/LibraryPage";
import PlatformsPage from "./pages/PlatformsPage";
import RomPage from "./pages/RomPage";

function useTitleSync(): void {
	const { pathname } = useLocation();
	useEffect(() => {
		const label = pathname === "/" ? "" : pathname.split("/")[1] ?? "";
		document.title = label ? `${label} / roms.tn` : "roms.tn - the retro preservation index";
	}, [pathname]);
}

function ScrollToTop() {
	const { pathname } = useLocation();
	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "auto" });
	}, [pathname]);
	return null;
}

/** Persistent footer line: data source label + live index status. */
function IndexStatus() {
	const { status, sourceLabel, total } = useRomIndex();
	return (
		<p className="fixed inset-x-0 bottom-4 z-30 px-5 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-white/28">
			{status} - {sourceLabel} - {total ? `${total.toLocaleString()} records` : "no records yet"} - source {DATA_SOURCE_HOST}
		</p>
	);
}

function Shell() {
	useTitleSync();
	return (
		<div className="relative min-h-screen bg-[#060608] font-sans text-white antialiased">
			<ZenNav />
			<main className="min-h-screen">
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/browse" element={<BrowsePage />} />
					<Route path="/library" element={<LibraryPage />} />
					<Route path="/collections" element={<CollectionsPage />} />
					<Route path="/collections/:id" element={<CollectionDetailPage />} />
					<Route path="/rom/:slugOrId" element={<RomPage />} />
					<Route path="/platforms" element={<PlatformsPage />} />
					<Route path="*" element={<HomePage />} />
				</Routes>
			</main>
			<IndexStatus />
			<Footer />
			<ScrollToTop />
		</div>
	);
}

export default function App() {
	return (
		<RomIndexProvider>
			<Shell />
		</RomIndexProvider>
	);
}
