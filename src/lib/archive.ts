import { db } from "@/db";
import { games, savedGames, collections, collectionGames } from "@/db/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { CATALOG } from "./catalog";
import type { Library } from "./types";

let seedPromise: Promise<void> | undefined;

export function ensureCatalog() {
  if (!seedPromise) {
    seedPromise = db.insert(games).values(CATALOG).onConflictDoNothing().then(() => undefined).catch((error) => {
      seedPromise = undefined;
      throw error;
    });
  }
  return seedPromise;
}

export async function getGames(options: { query?: string; platform?: string; genre?: string; decade?: string; sort?: string } = {}) {
  await ensureCatalog();
  const filters = [];
  if (options.query?.trim()) {
    const normalized = options.query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().slice(0, 100);
    const query = `%${normalized.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(sql`translate(lower(${games.title}), 'áàâäéèêëíìîïóòôöúùûüñ', 'aaaaeeeeiiiioooouuuun') ilike ${query}`, ilike(games.genre, query), ilike(games.platformName, query), ilike(games.developer, query)));
  }
  const families: Record<string, string[]> = { nintendo: ["n64", "snes", "gba", "gb"], playstation: ["ps1"], gameboy: ["gba", "gb"], sega: ["genesis"] };
  if (options.platform && options.platform !== "all") {
    filters.push(families[options.platform] ? inArray(games.platform, families[options.platform]) : eq(games.platform, options.platform));
  }
  if (options.genre && options.genre !== "all") filters.push(eq(games.genre, options.genre));
  if (options.decade && /^\d{4}$/.test(options.decade)) {
    const decade = Number(options.decade);
    filters.push(sql`${games.year} >= ${decade} and ${games.year} < ${decade + 10}`);
  }
  const sort = options.sort === "az" ? asc(games.title) : options.sort === "newest" ? desc(games.year) : options.sort === "oldest" ? asc(games.year) : asc(games.rank);
  return db.select().from(games).where(filters.length ? and(...filters) : undefined).orderBy(sort, asc(games.rank));
}

export async function getLibrary(visitorId: string): Promise<Library> {
  const [saved, userCollections] = await Promise.all([
    db.select({ gameId: savedGames.gameId }).from(savedGames).where(eq(savedGames.visitorId, visitorId)).orderBy(desc(savedGames.savedAt)),
    db.select().from(collections).where(eq(collections.visitorId, visitorId)).orderBy(desc(collections.createdAt)),
  ]);
  const members = userCollections.length ? await db.select().from(collectionGames).where(inArray(collectionGames.collectionId, userCollections.map((collection) => collection.id))) : [];
  return {
    savedGameIds: saved.map((row) => row.gameId),
    collections: userCollections.map((collection) => ({ id: collection.id, name: collection.name, description: collection.description, color: collection.color, createdAt: collection.createdAt.toISOString(), gameIds: members.filter((member) => member.collectionId === collection.id).map((member) => member.gameId) })),
  };
}
