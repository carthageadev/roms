import { Navbar } from "../components/Navbar";

export function LegalPage() {
	return (
		<main className="min-h-screen bg-black text-white selection:bg-white/20">
			<Navbar />
			<div className="mx-auto max-w-3xl px-6 py-32">
				<h1 className="mb-12 font-display font-medium text-5xl tracking-tight md:text-6xl">
					Legal Information
				</h1>

				<div className="space-y-12">
					<section>
						<h2 className="mb-4 font-display text-2xl text-text-dim uppercase tracking-widest">
							DMCA & Copyright
						</h2>
						<p className="text-text-secondary leading-relaxed">
							roms.tn respects the intellectual property rights of others. The
							platform operates as a metadata index and browser-based interface.
							<strong>
								{" "}
								We do not store, host, or distribute copyrighted ROM files.{" "}
							</strong>
							All titles listed utilize public domain mock data or externally
							referenced assets provided for educational preservation.
						</p>
					</section>

					<section>
						<h2 className="mb-4 font-display text-2xl text-text-dim uppercase tracking-widest">
							Terms of Service
						</h2>
						<p className="text-text-secondary leading-relaxed">
							By using roms.tn, you acknowledge that this is a demonstration
							project. Any emulation performed occurs client-side in your
							browser. Users are responsible for ensuring they have the legal
							right to use any software they interact with.
						</p>
					</section>

					<section className="border-white/10 border-t pt-12">
						<p className="text-sm text-text-dim">
							Project curated by Ahmed Ben Abdallah. <br />
							&copy; {new Date().getFullYear()} roms.tn — For preservation
							purposes only.
						</p>
					</section>
				</div>
			</div>
		</main>
	);
}
