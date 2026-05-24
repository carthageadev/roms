"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const SYSTEMS = [
  { name: "Nintendo 64", sub: "1996 Generation", count: "350+ Titles" },
  { name: "PlayStation", sub: "1994 Generation", count: "1,200+ Titles" },
  { name: "GameCube", sub: "2001 Generation", count: "150+ Titles" },
  { name: "Dreamcast", sub: "1998 Generation", count: "200+ Titles" },
];

export function ConsoleGrid() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(cardsRef.current, {
        y: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: "expo.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="library" className="py-32 relative px-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
          <div className="max-w-xl">
            <h2 className="font-display font-medium text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
              The Collection
            </h2>
            <p className="text-text-secondary text-lg leading-relaxed">
              Our archives house the definitive versions of classics, optimized for 
              high-fidelity rendering and input accuracy.
            </p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-text-dim">
            Archive Tier 01 / Selected Systems
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SYSTEMS.map((system, i) => (
            <div
              key={system.name}
              ref={(el) => { if (el) cardsRef.current[i] = el; }}
              className="glass-panel card-hover p-10 flex flex-col items-start h-[320px]"
              role="group"
              aria-labelledby={`sys-title-${i}`}
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-10 border border-white/5">
                 <div className="w-4 h-4 rounded-sm border border-white/40 group-hover:bg-white" />
              </div>
              
              <div className="mt-auto">
                <h3 id={`sys-title-${i}`} className="font-display font-bold text-2xl mb-2">
                  {system.name}
                </h3>
                <p className="text-text-dim text-xs uppercase tracking-widest font-bold mb-4">
                  {system.sub}
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-accent-gold" />
                  <span className="text-[10px] text-text-secondary uppercase tracking-[0.2em] font-black">
                    {system.count}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
