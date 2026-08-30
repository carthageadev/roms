import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";

import { CustomCursor } from "./components/CustomCursor";
import { AboutPage } from "./pages/About";
import { HomePage } from "./pages/Home";
import { LegalPage } from "./pages/Legal";
import { NotFoundPage } from "./pages/NotFound";

const rootRoute = createRootRoute({
	component: () => (
		<>
			<CustomCursor />
			<Outlet />
		</>
	),
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

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute, legalRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
