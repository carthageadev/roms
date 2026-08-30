import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";

import { CustomCursor } from "./components/CustomCursor";
import { HomePage } from "./pages/Home";
import { AboutPage } from "./pages/About";
import { LegalPage } from "./pages/Legal";

const rootRoute = createRootRoute({
	component: () => (
		<>
			<CustomCursor />
			<Outlet />
		</>
	),
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

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute, legalRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
