import { gsap } from "gsap";
import { useEffect, useRef } from "react";
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
			{ y: 0, opacity: 1, duration: 1.8, delay: 0.5 },
		)
			.fromTo(
				subtitleRef.current,
				{ y: 30, opacity: 0 },
				{ y: 0, opacity: 1, duration: 1.5 },
				"-=1.4",
			)
			.fromTo(
				ctaRef.current,
				{ y: 20, opacity: 0 },
				{ y: 0, opacity: 1, duration: 1.2 },
				"-=1.2",
			);
	}, []);

	return (
		<section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-24">
			<div className="mesh-background" />

			<div className="relative z-10 w-full max-w-5xl text-center">
				<div ref={containerRef}>
					<div className="mb-10 inline-flex flex-col items-center gap-6 sm:flex-row">
						<div className="glass-panel !bg-white/5 !rounded-full inline-flex items-center gap-3 px-4 py-2">
							<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-blue" />
							<span className="font-bold text-[10px] text-text-secondary uppercase tracking-[0.25em]">
								A New Era for Preserving Legends
							</span>
						</div>
						<AwardBadge
							link="https://producthunt.com"
							place={1}
							type="product-of-the-day"
						/>
					</div>

					<h1
						className="mb-10 font-display font-medium text-7xl leading-[0.95] tracking-tight md:text-8xl lg:text-9xl"
						ref={titleRef}
					>
						Nostalgia, <br />
						<span className="serif font-normal italic italic opacity-80">
							refined.
						</span>
					</h1>

					<p
						className="mx-auto mb-14 max-w-2xl font-sans text-lg text-text-secondary leading-relaxed md:text-xl"
						ref={subtitleRef}
					>
						Rediscover the titles that defined a generation. rom.tn provides a
						curated, high-fidelity environment for retro gaming preservation and
						browser emulation.
					</p>

					<div
						className="flex flex-col items-center justify-center gap-8 sm:flex-row"
						ref={ctaRef}
					>
						<button
							aria-label="Explore Library"
							className="btn-luxe btn-primary min-w-[200px]"
							type="button"
						>
							Explore Library
						</button>
						<button
							aria-label="How it works"
							className="btn-luxe btn-outline min-w-[200px]"
							type="button"
						>
							Learn the Craft
						</button>
					</div>
				</div>
			</div>

			{/* Scroll Indicator */}
			<div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3">
				<span className="font-bold text-[9px] text-text-dim uppercase tracking-[0.4em]">
					Scroll
				</span>
				<div className="relative h-10 w-[1px] overflow-hidden bg-white/20">
					<div className="absolute top-0 left-0 h-4 w-full animate-scroll-line bg-white" />
				</div>
			</div>
		</section>
	);
}
