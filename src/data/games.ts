export interface Game {
	title: string;
	/** Optional better search term for the art provider */
	search?: string;
	/** Bundled art filename slug in src/assets/art/n64 (defaults to slugified title) */
	art?: string;
}

export interface Platform {
	id: string;
	name: string;
	/** ScreenScraper system id */
	systemId: number;
	games: Game[];
}

export const PLATFORMS: Platform[] = [
	{
		id: "n64",
		name: "Nintendo 64",
		systemId: 14,
		games: [
			{ title: "Pokemon Stadium" },
			{ title: "Pokemon Snap" },
			{ title: "Mario Party" },
			{ title: "Castlevania" },
			{ title: "Bomberman 64" },
			{ title: "Super Mario 64" },
			{ title: "Mario Kart 64" },
			{
				title: "The Legend of Zelda: Ocarina of Time",
				search: "Ocarina of Time",
				art: "ocarina-of-time",
			},
			{ title: "Star Fox 64" },
			{ title: "GoldenEye 007" },
			{ title: "Banjo-Kazooie" },
			{ title: "Donkey Kong 64" },
		],
	},
];
