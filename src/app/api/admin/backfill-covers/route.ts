import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { ensureCatalog } from "@/lib/archive";
import { CATALOG } from "@/lib/catalog";
import { fetchGameCover } from "@/lib/covers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot backfill of catalog box art. ScreenScraper is not reachable from
 * every network, so this runs where it is (e.g. production) instead of at
 * seed time: POST with `x-admin-token` matching ADMIN_TOKEN.
 */
export async function POST(request: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  if (!token || request.headers.get("x-admin-token") !== token) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    await ensureCatalog();
    const updated: string[] = [];
    const missing: string[] = [];
    for (const game of CATALOG) {
      const cover = await fetchGameCover(game.title);
      if (cover) {
        await db.update(games).set({ cover }).where(eq(games.id, game.id));
        updated.push(game.id);
      } else {
        missing.push(game.id);
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    return NextResponse.json({ updated, missing }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Cover backfill failed", error);
    return NextResponse.json({ error: "The backfill failed. Please try again." }, { status: 500 });
  }
}
