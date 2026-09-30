import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";

const dmSans = localFont({ src: "../../public/fonts/dm-sans.ttf", display: "swap", variable: "--font-dm-sans", weight: "100 1000" });

export const metadata: Metadata = {
  metadataBase: new URL("https://roms.tn"),
  title: "roms.tn — Good games. Never forgotten.",
  description: "A quieter corner of the internet for the games you love. Discover timeless classics, save your favorites, and build your own retro game collections.",
  applicationName: "roms.tn",
  icons: { icon: "/icon.svg" },
  openGraph: { title: "roms.tn — Good games. Never forgotten.", description: "Rediscover the classics. Keep the good games close.", type: "website", images: ["/images/handheld.jpg"] },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body className={`${dmSans.variable} antialiased`}>{children}</body></html>;
}
