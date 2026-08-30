import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

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
		<section className="relative px-6 py-32" id="library" ref={sectionRef}>
			<div className="mx-auto max-w-7xl">
				<header className="mb-20 flex flex-col justify-between gap-8 md:flex-row md:items-end">
					<div className="max-w-xl">
						<h2 className="mb-6 font-display font-medium text-4xl tracking-tight md:text-5xl lg:text-6xl">
							The Collection
						</h2>
						<p className="text-lg text-text-secondary leading-relaxed">
							Our archives house the definitive versions of classics, optimized
							for high-fidelity rendering and input accuracy.
						</p>
					</div>
					<p className="font-bold text-[10px] text-text-dim uppercase tracking-[0.4em]">
						Archive Tier 01 / Selected Systems
					</p>
				</header>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
					{SYSTEMS.map((system, i) => (
						<div
							className="glass-panel card-hover flex h-[320px] flex-col items-start p-10"
							key={system.name}
							ref={(el) => {
								if (el) cardsRef.current[i] = el;
							}}
						>
							<div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/5 bg-white/5">
								<div className="h-4 w-4 rounded-sm border border-white/40 group-hover:bg-white" />
							</div>

							<div className="mt-auto">
								<h3
									className="mb-2 font-bold font-display text-2xl"
									id={`sys-title-${i}`}
								>
									{system.name}
								</h3>
								<p className="mb-4 font-bold text-text-dim text-xs uppercase tracking-widest">
									{system.sub}
								</p>
								<div className="flex items-center gap-2">
									<span className="h-1 w-1 rounded-full bg-accent-gold" />
									<span className="font-black text-[10px] text-text-secondary uppercase tracking-[0.2em]">
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
