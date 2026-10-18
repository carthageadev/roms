"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { buildRing } from "../data/cartridgeModels.js";

// The 3D code is its own chunk. The ring is built after mount so the server
// and client markup match.
const CartridgeRing = dynamic(() => import("../three/CartridgeRing.jsx"), {
  ssr: false,
  loading: () => <div className="ring-loading" aria-hidden="true" />,
});

type RingCart = { id: string; title: string; platformName: string };
type RingControl = { step: (direction: number) => void };

const SKELETON_DOTS = Array.from({ length: 12 }, (_, i) => i);

export function HomeHero({ search }: { search: ReactNode }) {
  const [carts, setCarts] = useState<RingCart[] | null>(null);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const control = useRef<RingControl | null>(null);

  useEffect(() => {
    // Random per visit, so this runs once on the client after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarts(buildRing());
  }, []);

  const current = carts?.[index] ?? null;
  const total = carts?.length ?? 0;

  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-copy">
        <p className="eyebrow">THE PAST, PLAYED FORWARD</p>
        <h1 id="home-title">
          Good games.
          <span>Never forgotten.</span>
        </h1>
        <p className="home-lede">Rediscover the classics. Save your favorites, and keep the good ones close.</p>
      </div>

      <div className="ring-wrap">
        <div className={`ring-skeleton${loaded > 0 ? " is-hidden" : ""}`} aria-hidden="true">
          <span className="ring-skeleton-orbit" />
          {SKELETON_DOTS.map((i) => (
            <span key={i} className="ring-skeleton-dot" style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
        {carts ? (
          <CartridgeRing carts={carts} controlRef={control} onSelect={setIndex} onProgress={setLoaded} />
        ) : (
          <div className="ring-loading" aria-hidden="true" />
        )}
      </div>

      <div className="ring-hud" aria-live="polite">
        <button
          type="button"
          className="ring-arrow"
          aria-label="Previous cartridge"
          onClick={() => control.current?.step(-1)}
          disabled={!current}
        >
          &larr;
        </button>
        <div className="ring-caption">
          <span className="ring-index">
            {current ? `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}` : "\u00a0"}
          </span>
          <h2 key={current?.id ?? "empty"}>{current?.title ?? ""}</h2>
          <p>{current?.platformName ?? ""}</p>
        </div>
        <button
          type="button"
          className="ring-arrow"
          aria-label="Next cartridge"
          onClick={() => control.current?.step(1)}
          disabled={!current}
        >
          &rarr;
        </button>
      </div>

      <div className="home-search">{search}</div>
    </section>
  );
}
