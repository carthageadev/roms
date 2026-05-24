"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { AwardBadge } from "./AwardBadge";

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

    tl.fromTo(
      titleRef.current,
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.8, delay: 0.5 }
    )
    .fromTo(
      subtitleRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.5 },
      "-=1.4"
    )
    .fromTo(
      ctaRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2 },
      "-=1.2"
    );
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 overflow-hidden px-6">
      <div className="mesh-background" />
      
      <div className="relative z-10 w-full max-w-5xl text-center">
        <div ref={containerRef}>
          <div className="mb-10 inline-flex flex-col sm:flex-row items-center gap-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 glass-panel !bg-white/5 !rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-secondary">
                A New Era for Preserving Legends
              </span>
            </div>
            <AwardBadge type="product-of-the-day" place={1} link="https://producthunt.com" />
          </div>

          <h1 
            ref={titleRef}
            className="font-display font-medium text-7xl md:text-8xl lg:text-9xl mb-10 tracking-tight leading-[0.95]"
          >
            Nostalgia, <br />
            <span className="italic font-normal serif italic opacity-80">refined.</span>
          </h1>

          <p 
            ref={subtitleRef}
            className="mx-auto max-w-2xl text-text-secondary text-lg md:text-xl mb-14 font-sans leading-relaxed"
          >
            Rediscover the titles that defined a generation. rom.tn provides a curated, 
            high-fidelity environment for retro gaming preservation and browser emulation.
          </p>

          <div ref={ctaRef} className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <button className="btn-luxe btn-primary min-w-[200px]" aria-label="Explore Library">
              Explore Library
            </button>
            <button className="btn-luxe btn-outline min-w-[200px]" aria-label="How it works">
              Learn the Craft
            </button>
          </div>
        </div>
      </div>

      {/* Subtle Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-30">
        <span className="text-[9px] uppercase tracking-[0.4em] font-bold">Scroll</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent" />
      </div>
    </section>
  );
}
