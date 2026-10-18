"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { buildLineup } from "../data/cartridgeModels.js";

// The 3D code is its own chunk. The lineup is built after mount so the server
// and client markup match.
const CartridgeLine = dynamic(() => import("../three/CartridgeLine.jsx"), {
  ssr: false,
  loading: () => <div className="lineup-loading" aria-hidden="true" />,
});

type LineupCart = { id: string; title: string; platformName: string };
type LineupControl = { step: (direction: number) => void };

const SKELETON_DOTS = Array.from({ length: 5 }, (_, i) => i);

export function HomeHero() {
  const [carts, setCarts] = useState<LineupCart[] | null>(null);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const control = useRef<LineupControl | null>(null);

  useEffect(() => {
    // Random per visit, so this runs once on the client after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarts(buildLineup());
  }, []);

  const current = carts?.[index] ?? null;

  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-copy">
        <p className="eyebrow">THE PAST, PLAYED FORWARD</p>
        <h1 id="home-title">
          Good games. <span>Never forgotten.</span>
        </h1>
      </div>

      <div className="lineup-wrap">
        <div className={`lineup-skeleton${loaded > 0 ? " is-hidden" : ""}`} aria-hidden="true">
          {SKELETON_DOTS.map((i) => (
            <span key={i} className="lineup-skeleton-dot" style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
        {carts ? (
          <CartridgeLine carts={carts} controlRef={control} onSelect={setIndex} onProgress={setLoaded} />
        ) : (
          <div className="lineup-loading" aria-hidden="true" />
        )}
      </div>

      <div className="lineup-hud" aria-live="polite">
        <button
          type="button"
          className="lineup-arrow"
          aria-label="Previous cartridge"
          onClick={() => control.current?.step(-1)}
          disabled={!current}
        >
          &larr;
        </button>
        <div className="lineup-caption">
          <h2 key={current?.id ?? "empty"}>{current?.title ?? ""}</h2>
          <p>{current?.platformName ?? ""}</p>
        </div>
        <button
          type="button"
          className="lineup-arrow"
          aria-label="Next cartridge"
          onClick={() => control.current?.step(1)}
          disabled={!current}
        >
          &rarr;
        </button>
      </div>
    </section>
  );
}
