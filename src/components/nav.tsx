import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLibraryState } from "../lib/use-library";

const destinations = [
	{ href: "/browse", label: "Discover" },
	{ href: "/library", label: "Library" },
	{ href: "/collections", label: "Lists" },
	{ href: "/platforms", label: "Systems" },
];

export function ZenNav() {
	const [open, setOpen] = useState(false);
	const { pathname } = useLocation();
	const { saves, collections } = useLibraryState();
	const savedCount = Object.keys(saves).length;
	const collectionsCount = collections.length;

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<>
			<Link
				to="/"
				aria-label="Home"
				className="fixed left-5 top-5 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.22] bg-[#0a0a0d]/75 text-white backdrop-blur-xl transition-colors hover:bg-white hover:text-black sm:left-7 sm:top-7"
			>
				<span className="relative h-4 w-4" aria-hidden>
					<span className="absolute left-0 top-[7px] h-px w-4 rotate-[-34deg] bg-current" />
					<span className="absolute left-[4px] top-[8px] h-px w-3 rotate-[35deg] bg-current opacity-60" />
					<span className="absolute left-[7px] top-[6px] h-1 w-1 rounded-full bg-current" />
				</span>
			</Link>

			<div className="fixed right-5 top-5 z-50 sm:right-7 sm:top-7">
				<button
					type="button"
					aria-label="Open menu"
					aria-expanded={open}
					onClick={() => setOpen((value) => !value)}
					className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.22] bg-[#0a0a0d]/75 text-white backdrop-blur-xl transition-colors hover:bg-white hover:text-black"
				>
					<span className="relative h-3 w-3" aria-hidden>
						<span
							className={`absolute left-0 top-[5px] h-px w-3 bg-current transition-transform duration-300 ${
								open ? "rotate-45" : "-translate-y-[2px]"
							}`}
						/>
						<span
							className={`absolute left-0 top-[5px] h-px w-3 bg-current transition-transform duration-300 ${
								open ? "-rotate-45" : "translate-y-[2px]"
							}`}
						/>
					</span>
				</button>

				<div
					className={`absolute right-0 top-12 w-[190px] origin-top-right rounded-2xl border border-white/[0.14] bg-[#0b0b0f]/95 p-1.5 shadow-[0_20px_70px_rgba(0,0,0,.6)] backdrop-blur-2xl transition-all duration-300 ${
						open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
					}`}
				>
					{destinations.map((item) => {
						const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
						const count =
							item.href === "/library" ? savedCount : item.href === "/collections" ? collectionsCount : undefined;
						return (
							<Link
								key={item.href}
								to={item.href}
								onClick={() => setOpen(false)}
								className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] transition-colors ${
									active ? "bg-white text-black" : "text-white/80 hover:bg-white/[0.08] hover:text-white"
								}`}
							>
								{item.label}
								{count !== undefined && count > 0 && (
									<span className={`font-mono text-[10px] ${active ? "text-black/55" : "text-white/50"}`}>
										{count}
									</span>
								)}
							</Link>
						);
					})}
				</div>
			</div>
		</>
	);
}

export function Footer() {
	return (
		<footer className="mt-24 pb-12 pt-8">
			<div className="mx-auto flex max-w-[980px] flex-col items-center gap-3 px-5 text-center">
				<span className="h-px w-12 bg-white/[0.2]" />
				<p className="text-[12px] text-white/60">A quiet index for games worth keeping close.</p>
				<div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
					<Link to="/browse" className="hover:text-white">
						Discover
					</Link>
					<Link to="/library" className="hover:text-white">
						Keep
					</Link>
					<Link to="/collections" className="hover:text-white">
						Curate
					</Link>
				</div>
			</div>
		</footer>
	);
}
