import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Footer, ZenNav } from "./components/nav";
import { RomIndexProvider } from "./lib/rom-index-context";
import BrowsePage from "./pages/BrowsePage";
import CollectionDetailPage from "./pages/CollectionDetailPage";
import CollectionsPage from "./pages/CollectionsPage";
import Landing from "./pages/Landing";
import LibraryPage from "./pages/LibraryPage";
import PlatformsPage from "./pages/PlatformsPage";
import RomPage from "./pages/RomPage";

function useTitleSync(): void {
	const { pathname } = useLocation();
	useEffect(() => {
		const label = pathname === "/" ? "" : pathname.split("/")[1] ?? "";
		document.title = label ? `${label} / roms.tn` : "roms.tn - every cartridge, one page";
	}, [pathname]);
}

function ScrollToTop() {
	const { pathname, hash } = useLocation();
	useEffect(() => {
		if (hash) return;
		window.scrollTo({ top: 0, behavior: "auto" });
	}, [pathname, hash]);
	return null;
}

function Shell() {
	useTitleSync();
	const { pathname } = useLocation();
	// The landing owns its quiet navigation, metallic mark, and footer.
	// Inner-page navigation must not sit on top of the gallery.
	const isLanding = pathname === "/";
	return (
		<div className="relative min-h-screen bg-[#0a0a0b] font-sans text-[#f5f5f2] antialiased">
			{!isLanding && <ZenNav />}
			<main className="min-h-screen">
				<Routes>
					<Route path="/" element={<Landing />} />
					<Route path="/browse" element={<BrowsePage />} />
					<Route path="/library" element={<LibraryPage />} />
					<Route path="/collections" element={<CollectionsPage />} />
					<Route path="/collections/:id" element={<CollectionDetailPage />} />
					<Route path="/rom/:slugOrId" element={<RomPage />} />
					<Route path="/platforms" element={<PlatformsPage />} />
					<Route path="*" element={<Landing />} />
				</Routes>
			</main>
			{!isLanding && <Footer />}
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
