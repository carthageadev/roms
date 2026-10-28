import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import "./home-dark.css";
import "./coming-soon.css";

const dmSans = localFont({ src: "../../public/fonts/dm-sans.ttf", display: "swap", variable: "--font-dm-sans", weight: "100 1000" });

export const metadata: Metadata = {
  metadataBase: new URL("https://roms.tn"),
  title: "roms.tn  -  A closer look at cartridges",
  description: "An upcoming archive of the physical details of game cartridges, from plastic shells and chips to notches, screws, and differences between releases.",
  applicationName: "roms.tn",
  icons: { icon: "/icon.svg" },
  openGraph: { title: "roms.tn  -  A closer look at cartridges", description: "An upcoming archive of the physical details of game cartridges.", type: "website" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body className={`${dmSans.variable} antialiased`}>{children}</body></html>;
}
