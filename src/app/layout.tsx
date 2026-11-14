import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import "./home-dark.css";
import "./coming-soon.css";

const bricolage = localFont({ src: "../../public/fonts/bricolage-grotesque.woff2", display: "swap", variable: "--font-bricolage", weight: "200 800" });

export const metadata: Metadata = {
  metadataBase: new URL("https://roms.tn"),
  title: "roms.tn  -  The object is the archive",
  description: "A field guide to the physical details of game cartridges: shells, chips, notches, screws, and the small differences between releases.",
  applicationName: "roms.tn",
  icons: { icon: { url: "/cartridge-icon.svg", type: "image/svg+xml", sizes: "any" } },
  openGraph: { title: "roms.tn  -  The object is the archive", description: "A field guide to the physical details of game cartridges.", type: "website" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body className={`${bricolage.variable} antialiased`}>{children}</body></html>;
}
