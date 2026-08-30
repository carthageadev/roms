import { Link } from "@tanstack/react-router";

import { Navbar } from "../components/Navbar";

export function NotFoundPage() {
	return (
		<main className="min-h-screen bg-black text-white selection:bg-white/20">
			<Navbar />
			<div className="flex flex-col items-center justify-center px-6 py-40 text-center">
				<div className="mb-8 font-black text-[10px] text-accent-gold uppercase tracking-[0.4em]">
					Error 404
				</div>
				<h1 className="mb-10 font-display font-medium text-6xl tracking-tight md:text-7xl">
					Cartridge <br />
					<span className="opacity-50">Not Found</span>
				</h1>
				<p className="mb-12 max-w-md text-lg text-text-secondary leading-relaxed">
					The page you're looking for was never burned to this disc. It may have
					been moved, or it never existed at all.
				</p>
				<Link className="btn-luxe btn-primary !rounded-xl" to="/">
					Back to the Vault
				</Link>
			</div>
		</main>
	);
}
