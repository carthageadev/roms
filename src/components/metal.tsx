import { MetalFx, useMetalBend, type MetalFxPreset, type MetalFxVariant } from "metal-fx";
import { useRef, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

export type Preset = MetalFxPreset;

/** Metal is reserved for the few controls where a choice has weight. */
export function MetalLink({
	href,
	children,
	preset = "chromatic",
	strength = 1,
	size = "md",
}: {
	href: string;
	children: ReactNode;
	preset?: Preset;
	strength?: number;
	size?: "sm" | "md";
}) {
	const ref = useRef<HTMLAnchorElement>(null);
	useMetalBend(ref);

	const dims = size === "sm" ? "h-9 px-4 text-[11.5px]" : "h-11 px-6 text-[12.5px]";

	return (
		<MetalFx preset={preset} strength={strength} theme="dark" innerShadow>
			<Link
				ref={ref}
				to={href}
				className={`inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[0.01em] text-white transition-colors hover:text-white ${dims}`}
			>
				{children}
			</Link>
		</MetalFx>
	);
}

export function MetalShell({
	children,
	preset = "chromatic",
	strength = 1,
	variant = "button",
	className = "",
}: {
	children: ReactNode;
	preset?: Preset;
	strength?: number;
	variant?: MetalFxVariant;
	className?: string;
}) {
	return (
		<MetalFx
			preset={preset}
			strength={strength}
			variant={variant}
			theme="dark"
			innerShadow
			className={className}
		>
			{children}
		</MetalFx>
	);
}

/** Crisp CSS brushed-chrome type - far sharper at display sizes than canvas text. */
export function MetalHeadline({ children, className = "" }: { children: string; className?: string }) {
	return <span className={`chrome-text block font-semibold leading-[1.02] ${className}`}>{children}</span>;
}

export interface SearchConsoleProps {
	defaultQuery?: string;
	totalTitles?: number;
	autoFocus?: boolean;
	placeholder?: string;
	submitLabel?: string;
}

/**
 * The hero / browse search console. Submits to /browse?q=… so the result set
 * is always linkable and survives a reload.
 */
export function MetalSearchConsole({
	defaultQuery = "",
	totalTitles = 0,
	autoFocus = false,
	placeholder = "Search a game…",
	submitLabel = "Search",
}: SearchConsoleProps) {
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const submitRef = useRef<HTMLButtonElement>(null);
	useMetalBend(submitRef);

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const value = inputRef.current?.value.trim() ?? "";
		navigate(value ? `/browse?q=${encodeURIComponent(value)}` : "/browse");
	};

	return (
		<form
			action="/browse"
			onSubmit={onSubmit}
			className="group relative flex max-w-[660px] items-center gap-2 rounded-full border border-white/[0.12] bg-[#0a0a0e]/90 p-1.5 pl-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-colors focus-within:border-white/20"
		>
			<span className="font-mono text-[12px] text-white/52" aria-hidden>
				⌕
			</span>
			<input
				ref={inputRef}
				name="q"
				defaultValue={defaultQuery}
				autoFocus={autoFocus}
				placeholder={placeholder}
				aria-label={`Search ${totalTitles.toLocaleString()} games`}
				className="h-9 flex-1 bg-transparent text-[14px] text-white placeholder:text-white/48 focus:outline-none"
			/>
			<MetalFx preset="chromatic" strength={1} theme="dark" innerShadow>
				<button
					ref={submitRef}
					type="submit"
					className="inline-flex h-9 items-center justify-center rounded-full bg-transparent px-5 text-[12px] font-medium tracking-[0.01em] text-white"
				>
					{submitLabel}
				</button>
			</MetalFx>
		</form>
	);
}
