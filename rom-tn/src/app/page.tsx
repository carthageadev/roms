import Link from "next/link";
import { HydrateClient } from "~/trpc/server";
import { Navbar } from "./_components/Navbar";
import { Hero } from "./_components/Hero";
import { ConsoleGrid } from "./_components/ConsoleGrid";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="relative min-h-screen">
        <Navbar />
        <Hero />
        
        {/* Subtle Accent Line */}
        <div className="w-full flex justify-center py-20 px-6 overflow-hidden">
           <div className="w-full max-w-7xl h-[1px] bg-gradient-to-r from-transparent via-glass-border to-transparent" />
        </div>

        <ConsoleGrid />

        {/* Featured Section - Museum/Gallery Style */}
        <section className="py-40 bg-surface/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center gap-20 mb-32">
              <div className="flex-1">
                <div className="mb-8 text-[10px] font-black uppercase tracking-[0.4em] text-accent-gold">
                  Featured Artifact
                </div>
                <h2 className="font-display font-medium text-5xl md:text-6xl lg:text-7xl mb-10 tracking-tight">
                  The Ocarina <br />
                  <span className="opacity-50">of Time</span>
                </h2>
                <p className="text-text-secondary text-lg leading-relaxed mb-12">
                  Often cited as the greatest game of all time, now preserved in 
                  4K bit-perfect resolution. Experience the masterpiece as it was 
                  intended—but with the fidelity of today.
                </p>
                <div className="flex items-center gap-10">
                   <button className="btn-luxe btn-primary !rounded-xl">Enter Hyrule</button>
                   <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-widest text-text-dim font-bold">Release</span>
                      <span className="text-sm font-medium">Nov 21, 1998</span>
                   </div>
                </div>
              </div>

              <div className="flex-1 relative aspect-square">
                 <div className="absolute inset-0 bg-accent-gold/5 blur-[100px] rounded-full" />
                 <div className="relative w-full h-full glass-panel flex items-center justify-center p-12 overflow-hidden shadow-2xl">
                    <div className="w-full h-full bg-void/40 rounded-lg border border-white/5 animate-float flex items-center justify-center">
                       {/* Placeholder for high-end graphic */}
                       <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/5 rounded-full" />
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
               {[
                 { title: "Metroid Prime", label: "GameCube", color: "bg-blue-900/40" },
                 { title: "Metal Gear Solid 2", label: "PlayStation 2", color: "bg-gray-800/40" },
                 { title: "Shenmue", label: "Dreamcast", color: "bg-orange-900/40" }
               ].map((game, i) => (
                 <div key={i} className="group cursor-pointer">
                    <div className="aspect-[16/10] glass-panel mb-8 overflow-hidden">
                       <div className={`w-full h-full ${game.color} blur-xl group-hover:scale-110 transition-transform duration-[2s]`} />
                    </div>
                    <div className="flex justify-between items-center px-2">
                       <h3 className="font-display font-bold text-xl">{game.title}</h3>
                       <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">{game.label}</span>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </section>

        {/* Footer - Elegant & Concise */}
        <footer className="py-32 bg-deep border-t border-glass-border">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-12 mb-20">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-white" />
                <span className="font-display font-medium text-2xl tracking-tight">rom.tn</span>
              </div>
              <ul className="flex flex-wrap items-center justify-center gap-10 text-[10px] uppercase font-bold tracking-[0.3em] text-text-dim">
                <li><Link href="#archive" className="hover:text-white transition-colors">Archive</Link></li>
                <li><Link href="#dev" className="hover:text-white transition-colors">API</Link></li>
                <li><Link href="#legal" className="hover:text-white transition-colors">Copyright</Link></li>
                <li><Link href="#discord" className="hover:text-white transition-colors">Discord</Link></li>
              </ul>
            </div>
            
            <div className="text-center text-[10px] font-bold uppercase tracking-[0.5em] text-text-dim opacity-50">
              Preserving Virtual History — All Rights Reserved 2026
            </div>
          </div>
        </footer>
      </main>
    </HydrateClient>
  );
}
