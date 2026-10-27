"use client";

import dynamic from "next/dynamic";

// Keep WebGL out of the initial page and leave the copy usable without it.
const CartridgeShowcase = dynamic(() => import("../three/CartridgeShowcase.jsx"), {
  ssr: false,
  loading: () => <div className="showcase-loading" aria-hidden="true" />,
});

export function HomeHero() {
  return (
    <main className="archive-home" aria-labelledby="home-title">
      <div className="archive-home-inner">
        <header className="archive-masthead">
          <span className="archive-name">roms.tn</span>
          <span className="archive-masthead-divider" aria-hidden="true" />
          <span className="archive-masthead-note">A physical archive</span>
        </header>

        <CartridgeShowcase />

        <section className="archive-intro">
          <p className="archive-eyebrow">A closer look</p>
          <h1 id="home-title">The little details<br />{" "}<span>worth keeping.</span></h1>
          <p className="archive-description">
            roms.tn is an upcoming repository for the physical details of game cartridges - from
            cartridge types and plastic shells to chips, notches, screw types and the small differences between releases.
          </p>
          <div className="archive-access">
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
