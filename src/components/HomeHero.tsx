"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  LINEUP_TITLES,
  PLATFORM_NAMES,
  SHOWCASE_PLATFORMS,
} from "../data/cartridgeModels.js";

// Keep WebGL out of the initial page and leave the copy usable without it.
const CartridgeShowcase = dynamic(() => import("../three/CartridgeShowcase.jsx"), {
  ssr: false,
  loading: () => <div className="showcase-loading" aria-hidden="true" />,
});

type Game = { title: string; cover: string };

type ShowcaseChoice = {
  platform: string;
  platformName: string;
  title: string;
  label: string;
};

const platforms = SHOWCASE_PLATFORMS as string[];
const titles = LINEUP_TITLES as Record<string, Game[]>;
const names = PLATFORM_NAMES as Record<string, string>;
const rise = (step: number) => ({ "--rise": step } as CSSProperties);

// One system per visit, drawn after mount so the server and the client agree
// on the same first paint. A visit only downloads the shell and label it shows.
function pickShowcase(): ShowcaseChoice {
  const platform = platforms[Math.floor(Math.random() * platforms.length)];
  const games = titles[platform] ?? [];
  const game = games[Math.floor(Math.random() * games.length)];
  return {
    platform,
    platformName: names[platform] ?? platform,
    title: game?.title ?? names[platform] ?? platform,
    label: game?.cover ?? "/label-placeholder.svg",
  };
}

export function HomeHero() {
  const [choice, setChoice] = useState<ShowcaseChoice | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(pickShowcase());
  }, []);

  return (
    <main className="archive-home" aria-labelledby="home-title">
      <div className="archive-home-inner">
        <header className="archive-masthead rise" style={rise(0)}>
          <span className="archive-name">roms.tn</span>
          <span className="archive-masthead-divider" aria-hidden="true" />
          <span className="archive-masthead-note">Field notes on cartridges</span>
        </header>

        <div className="showcase-slot rise" style={rise(1)}>
          {choice ? (
            <CartridgeShowcase
              platform={choice.platform}
              platformName={choice.platformName}
              title={choice.title}
              label={choice.label}
            />
          ) : (
            <div className="showcase-loading" aria-hidden="true" />
          )}
        </div>

        <section className="archive-intro">
          <p className="archive-eyebrow rise" style={rise(2)}>
            A physical archive
          </p>
          <h1 id="home-title" className="rise" style={rise(3)}>
            The object is<br />{" "}
            <span>the archive.</span>
          </h1>
          <p className="archive-description rise" style={rise(4)}>
            Every release leaves a trace in the plastic. The shape of a shell, the cut of a
            notch, the thread of a screw, the chips beneath the label. roms.tn is an upcoming
            catalogue of those details, for anyone who still turns a cartridge over in their
            hands.
          </p>
          <div className="archive-access rise" style={rise(5)}>
            <button className="access-status" type="button" disabled>
              <span className="access-status-dot" aria-hidden="true" />
              Access closed
            </button>
            <p>Opening soon.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
