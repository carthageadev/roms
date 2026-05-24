import "~/styles/globals.css";

import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { CustomCursor } from "./_components/CustomCursor";

export const metadata: Metadata = {
	title: "ROM.TN — Discover & Play Classic ROMs",
	description:
		"The indie home for retro gaming. Play thousands of classic titles directly in your browser with high-fidelity emulation and zero lag.",
	icons: [{ rel: "icon", url: "/icon.svg" }],
	openGraph: {
		title: "ROM.TN — Retro Gaming Archives",
		description: "Rediscover the titles that defined a generation. Curated classics, optimized for the web.",
		url: "https://roms.tn",
		siteName: "roms.tn",
		images: [
			{
				url: "/preview.png",
				width: 1200,
				height: 630,
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "ROM.TN — Retro Gaming Archives",
		description: "Rediscover the titles that defined a generation. Curated classics, optimized for the web.",
		images: ["/preview.png"],
	},
};

const dmSans = DM_Sans({
	subsets: ["latin"],
	variable: "--font-dm-sans",
	display: "swap",
});

const syne = Syne({
	subsets: ["latin"],
	variable: "--font-syne",
	display: "swap",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${dmSans.variable} ${syne.variable}`} lang="en">
			<body className="antialiased">
				<CustomCursor />
				<TRPCReactProvider>{children}</TRPCReactProvider>
			</body>
		</html>
	);
}
