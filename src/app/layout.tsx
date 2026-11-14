import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import "./home-dark.css";
import "./coming-soon.css";

const instrumentSans = localFont({ src: "../../public/fonts/instrument-sans.ttf", display: "swap", variable: "--font-instrument-sans", weight: "400 700" });

export const metadata: Metadata = {
  metadataBase: new URL("https://roms.tn"),
  title: "roms.tn  -  The object is the archive",
  description: "A field guide to the physical details of game cartridges: shells, chips, notches, screws, and the small differences between releases.",
  applicationName: "roms.tn",
  icons: { icon: { url: "/cartridge-icon.svg", type: "image/svg+xml", sizes: "any" } },
  openGraph: { title: "roms.tn  -  The object is the archive", description: "A field guide to the physical details of game cartridges.", type: "website" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body className={`${instrumentSans.variable} antialiased`}>{children}</body></html>;
}
