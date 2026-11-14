"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  LINEUP_TITLES,
  PLATFORM_NAMES,
  SHOWCASE_PLATFORMS,
  SHOWCASE_SPECIALS,
} from "../data/cartridgeModels.js";

// Keep WebGL out of the initial page and leave the copy usable without it.
const CartridgeShowcase = dynamic(() => import("../three/CartridgeShowcase.jsx"), {
  ssr: false,
  loading: () => <div className="showcase-loading" aria-hidden="true" />,
});

type Game = { title: string; cover: string };
type Special = Game & { variant?: string };

type ShowcaseChoice = {
  platform: string;
  platformName: string;
  title: string;
  label: string;
  variant?: string;
};

const platforms = SHOWCASE_PLATFORMS as string[];
const titles = LINEUP_TITLES as Record<string, Game[]>;
const specials = SHOWCASE_SPECIALS as Record<string, Special[]>;
const names = PLATFORM_NAMES as Record<string, string>;
const rise = (step: number) => ({ "--rise": step } as CSSProperties);

// Every game is one entry in a single flat pool, so the draw is even across
// labels rather than systems. A system with more games appears more often, and
// the two gold Zelda carts sit in the same pool as every other game.
const showcaseChoices: ShowcaseChoice[] = platforms.flatMap((platform) => {
  const games: Special[] = [...(titles[platform] ?? []), ...(specials[platform] ?? [])];
  return games.map((game) => ({
    platform,
    platformName: names[platform] ?? platform,
    title: game.title,
    label: game.cover,
    variant: game.variant,
  }));
});

// One game per visit, drawn after mount so the server and the client agree
// on the same first paint. A visit only downloads the shell and label it shows.
function pickShowcase(): ShowcaseChoice {
  return showcaseChoices[Math.floor(Math.random() * showcaseChoices.length)];
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
        <div className="showcase-slot rise" style={rise(0)}>
          {choice ? (
            <CartridgeShowcase
              platform={choice.platform}
              platformName={choice.platformName}
              title={choice.title}
              label={choice.label}
              variant={choice.variant}
            />
          ) : (
            <div className="showcase-loading" aria-hidden="true" />
          )}
        </div>

        <section className="archive-intro">
          <h1 id="home-title" className="rise" style={rise(1)}>
            The object is the archive.
          </h1>
          <p className="archive-description rise" style={rise(2)}>
            A catalogue of cartridges. Opening soon.
          </p>
        </section>
      </div>
    </main>
  );
}
