"use client";

import Image from "next/image";
import { BookmarkPlus, Pencil, Layers } from "lucide-react";
import { MetalFx } from "./MetalFx";
import type { Game, CuratedCollection, LibraryCollection } from "@/lib/types";
import { Modal } from "./Modal";
import { GameCard } from "./GameCard";

export function CollectionDetails({ collection, games, savedIds, busy, onClose, onOpenGame, onSaveGame, onClone, onEdit }: { collection: CuratedCollection | LibraryCollection; games: Game[]; savedIds: string[]; busy: boolean; onClose: () => void; onOpenGame: (game: Game) => void; onSaveGame: (game: Game) => void; onClone: () => void; onEdit: () => void }) {
  const members = collection.gameIds.map((id) => games.find((game) => game.id === id)).filter((game): game is Game => !!game);
  const curated = "curator" in collection;
  return <Modal title={collection.name} onClose={onClose} className="collection-detail-modal"><div className="collection-detail-hero" style={{ background: collection.color }}><div><span className="eyebrow">{curated ? "CURATED WITH CARE" : "MADE BY YOU"}</span><h2>{collection.name}</h2><p>{collection.description || "A little collection, entirely your own."}</p><span className="collection-byline">{members.length} games <span>·</span> {curated ? collection.curator : "Your private collection"}</span></div><div className="detail-cover-stack">{members.slice(0, 3).map((game, index) => <Image key={game.id} src={game.cover} alt="" width={150} height={150} className={`stack-cover stack-${index}`} sizes="150px" />)}</div></div><div className="collection-detail-body"><div className="collection-detail-toolbar"><span>Good company, all in one place.</span><MetalFx preset="chromatic" strength={1} theme="light"><button className="primary-button small-button" disabled={busy} onClick={curated ? onClone : onEdit}>{curated ? <BookmarkPlus size={15} /> : <Pencil size={15} />}{curated ? "Make it yours" : "Edit collection"}</button></MetalFx></div>{members.length ? <div className="game-grid collection-game-grid">{members.map((game) => <GameCard key={game.id} game={game} saved={savedIds.includes(game.id)} disabled={busy} onOpen={onOpenGame} onSave={onSaveGame} />)}</div> : <div className="empty-state"><Layers size={34} strokeWidth={1} /><h3>A shelf waiting for a story.</h3><p>Add a few favorites to bring this collection to life.</p><button className="primary-button" onClick={onEdit}>Choose some games</button></div>}</div></Modal>;
}
