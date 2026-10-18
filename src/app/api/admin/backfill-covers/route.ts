import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { ensureCatalog } from "@/lib/archive";
import { fetchGameCover } from "@/lib/covers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot backfill of catalog box art. ScreenScraper is not reachable from
 * every network and throttles aggressive clients, so this resolves one title
 * at a time with breathing room, and only touches rows still wearing
 * placeholders — re-running converges on the remainder. Run it where the API
 * answers (e.g. production): POST with `x-admin-token` matching ADMIN_TOKEN.
 */
export async function POST(request: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  if (!token || request.headers.get("x-admin-token") !== token) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    await ensureCatalog();
    const force = request.nextUrl.searchParams.get("force") === "1";
    const rows = await db.select().from(games).where(eq(games.source, "catalog"));
    const pending = rows.filter((row) => force || row.cover.startsWith("/images/"));
    const updated: string[] = [];
    const missing: string[] = [];
    for (const row of pending) {
      const cover = await fetchGameCover(row.title, 25000);
      if (cover) {
        await db.update(games).set({ cover }).where(eq(games.id, row.id));
        updated.push(row.id);
      } else {
        missing.push(row.id);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return NextResponse.json({ updated, missing }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Cover backfill failed", error);
    return NextResponse.json({ error: "The backfill failed. Please try again." }, { status: 500 });
  }
}
