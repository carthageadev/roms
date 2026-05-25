import "~/styles/globals.css";

import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { CustomCursor } from "./_components/CustomCursor";

export const metadata: Metadata = {
	title: "Roms.tn — The Vault of Classic Gaming",
	description:
		"Discover, preserve, and play thousands of legendary retro titles directly in your browser. Roms.tn is the definitive archive for classic gaming hardware emulation.",
	icons: [{ rel: "icon", url: "/icon.svg" }],
	openGraph: {
		title: "Roms.tn — Play Classic Retro Games Online",
		description: "The ultimate minimalist archive for retro consoles. High-fidelity emulation, zero latency, straight in your browser.",
		url: "https://roms.tn",
		siteName: "Roms.tn",
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
		title: "Roms.tn — The Vault of Classic Gaming",
		description: "Rediscover the titles that defined a generation. High-fidelity retro emulation on the web.",
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
