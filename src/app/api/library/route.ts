import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { games, savedGames, collections, collectionGames } from "@/db/schema";
import { ensureCatalog, getLibrary } from "@/lib/archive";
import { CATALOG } from "@/lib/catalog";

export const dynamic = "force-dynamic";
const COLORS = ["#e6eadf", "#e9e7df", "#e3e9de", "#e7e6ed", "#eee1e3", "#dee6ed", "#eee7d7"];

async function visitorId() {
  const cookie = (await cookies()).get("roms_visitor")?.value;
  return cookie && /^[a-f0-9-]{36}$/.test(cookie) ? cookie : randomUUID();
}

function respond(data: unknown, visitor: string) {
  const response = NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set("roms_visitor", visitor, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * The archive is the curated catalog and nothing more. There is no ROM index
 * behind it, so the only games that can be saved or listed are the ones the
 * catalog already knows by name.
 */
function isCatalogGame(gameId: string): boolean {
  return CATALOG.some((game) => game.id === gameId);
}

export async function GET() {
  try {
    await ensureCatalog();
    const visitor = await visitorId();
    const library = await getLibrary(visitor);
    const ids = [...new Set([...library.savedGameIds, ...library.collections.flatMap((collection) => collection.gameIds)])];
    const rows = ids.length ? await db.select().from(games).where(inArray(games.id, ids)) : [];
    return respond({ ...library, games: rows }, visitor);
  } catch (error) {
    console.error("Library lookup failed", error);
    return badRequest("Your library could not be loaded. Please try again.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCatalog();
    const visitor = await visitorId();
    let body: Record<string, unknown>;
    try {
      const input = await request.json();
      if (!input || typeof input !== "object" || Array.isArray(input)) return badRequest("A valid action is required.");
      body = input;
    } catch { return badRequest("Please send a valid request."); }
    const action = body.action;
    if (action === "toggle-save") {
      const gameId = typeof body.gameId === "string" ? body.gameId : "";
      if (!isCatalogGame(gameId)) return badRequest("That game is not in the archive.", 404);
      const [saved] = await db.select().from(savedGames).where(and(eq(savedGames.visitorId, visitor), eq(savedGames.gameId, gameId))).limit(1);
      if (saved) await db.delete(savedGames).where(and(eq(savedGames.visitorId, visitor), eq(savedGames.gameId, gameId)));
      else await db.insert(savedGames).values({ visitorId: visitor, gameId }).onConflictDoNothing();
    } else if (action === "create-collection" || action === "update-collection") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 100) return badRequest("Give your collection a name between 1 and 100 characters.");
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
      const color = typeof body.color === "string" && COLORS.includes(body.color) ? body.color : COLORS[0];
      if (!Array.isArray(body.gameIds) || body.gameIds.length > 100 || body.gameIds.some((id) => typeof id !== "string")) return badRequest("Please choose games from the archive.");
      const gameIds = [...new Set(body.gameIds as string[])];
      if (gameIds.some((id) => !isCatalogGame(id))) return badRequest("Please choose games from the archive.");
      let collectionId: string = randomUUID();
      if (action === "update-collection") {
        collectionId = typeof body.collectionId === "string" ? body.collectionId : "";
        const [owned] = await db.select().from(collections).where(and(eq(collections.id, collectionId), eq(collections.visitorId, visitor))).limit(1);
        if (!owned) return badRequest("Collection not found.", 404);
      }
      await db.transaction(async (tx) => {
        if (action === "create-collection") await tx.insert(collections).values({ id: collectionId, visitorId: visitor, name, description, color });
        else {
          await tx.update(collections).set({ name, description, color }).where(and(eq(collections.id, collectionId), eq(collections.visitorId, visitor)));
          await tx.delete(collectionGames).where(eq(collectionGames.collectionId, collectionId));
        }
        if (gameIds.length) await tx.insert(collectionGames).values(gameIds.map((gameId) => ({ collectionId, gameId }))).onConflictDoNothing();
      });
    } else if (action === "delete-collection" || action === "toggle-collection-game") {
      const collectionId = typeof body.collectionId === "string" ? body.collectionId : "";
      const [owned] = await db.select().from(collections).where(and(eq(collections.id, collectionId), eq(collections.visitorId, visitor))).limit(1);
      if (!owned) return badRequest("Collection not found.", 404);
      if (action === "delete-collection") await db.delete(collections).where(and(eq(collections.id, collectionId), eq(collections.visitorId, visitor)));
      else {
        const gameId = typeof body.gameId === "string" ? body.gameId : "";
        if (!isCatalogGame(gameId)) return badRequest("That game is not in the archive.", 404);
        const [member] = await db.select().from(collectionGames).where(and(eq(collectionGames.collectionId, collectionId), eq(collectionGames.gameId, gameId))).limit(1);
        if (member) await db.delete(collectionGames).where(and(eq(collectionGames.collectionId, collectionId), eq(collectionGames.gameId, gameId)));
        else await db.insert(collectionGames).values({ collectionId, gameId }).onConflictDoNothing();
      }
    } else return badRequest("Unknown library action.");
    const library = await getLibrary(visitor);
    return respond(library, visitor);
  } catch (error) {
    console.error("Library update failed", error);
    return badRequest("We could not save that change. Please try again.", 500);
  }
}