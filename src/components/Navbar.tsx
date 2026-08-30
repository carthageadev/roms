import { Link } from "@tanstack/react-router";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

export function Navbar() {
	const navRef = useRef<HTMLElement>(null);

	useEffect(() => {
		gsap.fromTo(
			navRef.current,
			{ y: -20, opacity: 0 },
			{ y: 0, opacity: 1, duration: 1.2, ease: "expo.out", delay: 0.2 },
		);
	}, []);

	return (
		<nav
			aria-label="Main Navigation"
			className="fixed top-0 right-0 left-0 z-50 flex items-center justify-center p-6"
			ref={navRef}
		>
			<div className="glass-panel !rounded-full flex w-full max-w-7xl items-center justify-between px-8 py-4">
				<Link
					className="group flex items-center gap-3 focus-visible:outline-white"
					to="/"
				>
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white transition-transform duration-500 group-hover:rotate-[360deg]">
						<div className="h-2 w-2 rounded-full bg-black" />
					</div>
					<span className="font-bold font-display text-white text-xl tracking-tight">
						rom<span className="text-text-secondary">.tn</span>
					</span>
				</Link>

				<div className="hidden items-center gap-10 md:flex">
					{["Library", "Emulators", "Community", "Journal"].map((item) => (
						<a
							className="font-medium text-text-secondary text-xs uppercase tracking-[0.2em] transition-colors hover:text-white focus-visible:text-white"
							href={`#${item.toLowerCase()}`}
							key={item}
						>
							{item}
						</a>
					))}
				</div>

				<div className="flex items-center gap-6">
					<button
						className="font-bold text-text-secondary text-xs uppercase tracking-widest underline-offset-4 transition-all hover:text-white hover:underline"
						type="button"
					>
						Login
					</button>
					<a
						className="btn-luxe btn-primary !py-2.5 !px-6 !text-[10px] !tracking-[0.15em] !uppercase !font-black"
						href="/join"
					>
						Get Started
					</a>
				</div>
			</div>
		</nav>
	);
}
