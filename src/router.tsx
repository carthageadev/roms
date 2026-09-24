import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";

import { AboutPage } from "./pages/About";
import { HomePage } from "./pages/Home";
import { LegalPage } from "./pages/Legal";
import { LibraryPage } from "./pages/Library";
import { NotFoundPage } from "./pages/NotFound";

const rootRoute = createRootRoute({
	component: () => <Outlet />,
	notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: HomePage,
});

const aboutRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/about",
	component: AboutPage,
});

const legalRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/legal",
	component: LegalPage,
});

const libraryRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/library",
	component: LibraryPage,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	aboutRoute,
	legalRoute,
	libraryRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
