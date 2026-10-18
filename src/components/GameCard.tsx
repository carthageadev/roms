"use client";

import Image from "next/image";
import { Bookmark } from "lucide-react";
import type { Game } from "@/lib/types";
import { PLATFORM_LABELS } from "@/lib/catalog";

export function GameCard({ game, saved, disabled, onSave, onOpen }: { game: Game; saved: boolean; disabled?: boolean; onSave: (game: Game) => void; onOpen: (game: Game) => void }) {
  return <article className="game-card"><div className="game-art" style={{ background: game.color }}><span className="platform-badge">{PLATFORM_LABELS[game.platform] ?? "ROM"}</span><button className={`save-button ${saved ? "is-saved" : ""}`} onClick={() => onSave(game)} disabled={disabled} aria-label={`${saved ? "Unsave" : "Save"} ${game.title}`} aria-pressed={saved}><Bookmark size={16} fill={saved ? "currentColor" : "none"} strokeWidth={1.6} /></button><button className="game-open" onClick={() => onOpen(game)} aria-label={`View ${game.title}`}><Image src={game.cover} alt={`${game.title} original box art`} width={400} height={400} className={`cover-image cover-${game.platform}`} sizes="(max-width: 600px) 45vw, (max-width: 900px) 40vw, 280px" /><span className="art-ground" /></button></div><button className="game-title" onClick={() => onOpen(game)}>{game.title}</button><div className="game-meta"><span>{game.platformName}</span><span className="meta-dot">·</span><span>{game.year}</span><span className="genre-label">{game.genre}</span></div></article>;
}
