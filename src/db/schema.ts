import { integer, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: varchar("id", { length: 80 }).primaryKey(),
  title: text("title").notNull(),
  platform: varchar("platform", { length: 40 }).notNull(),
  platformName: text("platform_name").notNull(),
  year: integer("year").notNull(),
  genre: text("genre").notNull(),
  developer: text("developer").notNull(),
  description: text("description").notNull(),
  cover: text("cover").notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  accent: varchar("accent", { length: 20 }).notNull(),
  rank: integer("rank").notNull(),
});

export const savedGames = pgTable("saved_games", {
  visitorId: varchar("visitor_id", { length: 64 }).notNull(),
  gameId: varchar("game_id", { length: 80 }).notNull().references(() => games.id, { onDelete: "cascade" }),
  savedAt: timestamp("saved_at").defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.visitorId, table.gameId] })]);

export const collections = pgTable("collections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  visitorId: varchar("visitor_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").default("").notNull(),
  color: varchar("color", { length: 20 }).default("#e6eadf").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collectionGames = pgTable("collection_games", {
  collectionId: varchar("collection_id", { length: 64 }).notNull().references(() => collections.id, { onDelete: "cascade" }),
  gameId: varchar("game_id", { length: 80 }).notNull().references(() => games.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.collectionId, table.gameId] })]);
