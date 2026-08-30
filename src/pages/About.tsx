import { Navbar } from "../components/Navbar";

export function AboutPage() {
	return (
		<main className="min-h-screen bg-black text-white selection:bg-white/20">
			<Navbar />
			<div className="mx-auto max-w-3xl px-6 py-32">
				<h1 className="mb-12 font-display font-medium text-5xl tracking-tight md:text-6xl">
					About roms.tn
				</h1>

				<div className="prose prose-invert prose-lg">
					<p className="mb-8 text-text-secondary leading-relaxed">
						roms.tn is a project created by <strong>Ahmed Ben Abdallah</strong>.
						It is designed as a tribute to the golden era of gaming, providing a
						modern interface to access and enjoy classic titles that shaped the
						industry.
					</p>

					<h2 className="mb-6 font-display text-3xl">Our Mission</h2>
					<p className="mb-8 text-text-secondary leading-relaxed">
						We believe in preservation through play. Our goal is to make
						historical software accessible through the browser, ensuring that
						the history of video games remains available for future generations
						to experience.
					</p>

					<div className="glass-panel rounded-2xl border border-white/10 p-8">
						<h3 className="mb-4 font-display text-accent-gold text-xl">
							Disclaimer
						</h3>
						<p className="text-sm text-text-dim leading-relaxed">
							roms.tn is a non-commercial educational project. We do not host
							any ROM files on our servers. All game data shown is for
							demonstration purposes using public metadata and mock assets. We
							strictly adhere to digital rights management and do not support
							copyright infringement.
						</p>
					</div>
				</div>
			</div>
		</main>
	);
}
