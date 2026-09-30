import type { games } from "@/db/schema";

export type Game = typeof games.$inferSelect;

export type LibraryCollection = {
  id: string;
  name: string;
  description: string;
  color: string;
  gameIds: string[];
  createdAt?: string;
};

export type Library = {
  savedGameIds: string[];
  collections: LibraryCollection[];
};

export type CuratedCollection = LibraryCollection & {
  eyebrow: string;
  curator: string;
};
