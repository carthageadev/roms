import { Link } from "react-router-dom";

/**
 * The only global chrome: a single metal R home mark. No menus, no bars.
 * Section navigation lives in each page footer; the landing has its own.
 */
export function ZenNav() {
	return (
		<Link
			to="/"
			aria-label="roms.tn home"
			className="fixed left-5 top-5 z-50 flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 sm:left-7 sm:top-7"
		>
			<img
				alt=""
				aria-hidden="true"
				className="h-10 w-10 rounded-full"
				height={40}
				src="/mark.svg"
				width={40}
			/>
		</Link>
	);
}

export function Footer() {
	return (
		<footer className="mt-24 pb-12 pt-8">
			<div className="mx-auto flex max-w-[980px] flex-col items-center gap-3 px-5 text-center">
				<span className="h-px w-12 bg-white/[0.2]" />
				<p className="text-[12px] text-white/60">Every cartridge, one page.</p>
				<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
					<Link to="/" className="hover:text-white">
						Home
					</Link>
					<Link to="/browse" className="hover:text-white">
						Discover
					</Link>
					<Link to="/library" className="hover:text-white">
						Library
					</Link>
					<Link to="/collections" className="hover:text-white">
						Lists
					</Link>
					<Link to="/platforms" className="hover:text-white">
						Systems
					</Link>
				</div>
			</div>
		</footer>
	);
}
