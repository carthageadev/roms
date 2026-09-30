"use client";

import Image from "next/image";
import { ArrowUpRight, Layers } from "lucide-react";
import type { Game, LibraryCollection, CuratedCollection } from "@/lib/types";

export function CollectionCard({ collection, games, onOpen }: { collection: LibraryCollection | CuratedCollection; games: Game[]; onOpen: () => void }) {
  const covers = collection.gameIds.slice(0, 3).map((id) => games.find((game) => game.id === id)).filter((game): game is Game => !!game);
  return <button className="collection-card" onClick={onOpen}><div className="collection-art" style={{ background: collection.color }}><span className="collection-eyebrow">{"eyebrow" in collection ? collection.eyebrow : "MADE BY YOU"}</span><div className="collection-covers">{covers.length ? covers.map((game, index) => <Image key={game.id} src={game.cover} alt={game.title} width={170} height={170} className={`stack-cover stack-${index}`} sizes="170px" />) : <Layers className="empty-collection-icon" size={45} strokeWidth={1} />}</div><span className="collection-arrow"><ArrowUpRight size={17} /></span></div><div className="collection-info"><div><h3>{collection.name}</h3><p>{collection.description || "A little collection, entirely your own."}</p></div><span className="collection-count">{collection.gameIds.length} games</span></div></button>;
}
