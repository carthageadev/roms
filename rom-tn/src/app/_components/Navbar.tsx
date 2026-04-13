"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import Link from "next/link";

export function Navbar() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.fromTo(
      navRef.current,
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2, ease: "expo.out", delay: 0.2 }
    );
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-6"
      aria-label="Main Navigation"
    >
      <div className="w-full max-w-7xl flex items-center justify-between px-8 py-4 glass-panel !rounded-full">
        <Link href="/" className="flex items-center gap-3 group focus-visible:outline-white">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center transition-transform duration-500 group-hover:rotate-[360deg]">
            <div className="w-2 h-2 bg-black rounded-full" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">
            rom<span className="text-text-secondary">.tn</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-10">
          {["Library", "Emulators", "Community", "Journal"].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-xs font-medium uppercase tracking-[0.2em] text-text-secondary hover:text-white transition-colors focus-visible:text-white"
            >
              {item}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <button className="text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-white transition-all underline-offset-4 hover:underline">
            Login
          </button>
          <Link
            href="/join"
            className="btn-luxe btn-primary !py-2.5 !px-6 !text-[10px] !tracking-[0.15em] !uppercase !font-black"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
