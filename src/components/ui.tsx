import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
	STATUS_KEYS,
	setPinned,
	setStatus,
	toggleSave,
	type LibraryStatus,
} from "../lib/library-store";
import { useLibraryState } from "../lib/use-library";
import { formatSizeMb, type RomView } from "../lib/rom-view";

export const STATUS_META: Record<LibraryStatus, { label: string; short: string; dot: string; badge: string }> = {
	saved: {
		label: "Queued",
		short: "QUEUED",
		dot: "bg-white/75",
		badge: "border-white/20 bg-white/[0.06] text-white/80",
	},
	playing: {
		label: "In Rotation",
		short: "PLAYING",
		dot: "bg-sky-300",
		badge: "border-sky-300/30 bg-sky-300/[0.08] text-sky-200",
	},
	completed: {
		label: "Completed",
		short: "CLEARED",
		dot: "bg-emerald-300",
		badge: "border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-200",
	},
	mastered: {
		label: "100% Mastered",
		short: "100%",
		dot: "bg-amber-300",
		badge: "border-amber-300/35 bg-amber-300/[0.1] text-amber-200",
	},
};

export function Eyebrow({ children }: { children: ReactNode }) {
	return (
		<p className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/72">
			<span className="h-[3px] w-[3px] rounded-full bg-white/70" aria-hidden />
			{children}
		</p>
	);
}

/**
 * Deterministic generated cover art. There is no artwork in the real index,
 * so a stable hue plus the title initials stands in for the box spine.
 */
export function Cover({
	view,
	className = "",
	compact = false,
	spineNumber,
}: {
	view: RomView;
	className?: string;
	compact?: boolean;
	spineNumber?: number;
}) {
	const { hue, initials } = view;
	return (
		<div
			className={`relative overflow-hidden rounded-[9px] ${className}`}
			style={{
				background: `radial-gradient(125% 95% at 18% 0%, hsl(${hue} 48% 24%), hsl(${(hue + 36) % 360} 36% 7%) 64%, #060608 100%)`,
			}}
		>
			<div
				className="absolute inset-0 opacity-[0.22]"
				style={{ backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,.14) 0 1px, transparent 1px 10px)" }}
				aria-hidden
			/>
			<div className="sheen absolute -left-1/3 -top-1/2 h-[200%] w-[80%] rotate-12 opacity-[0.12]" aria-hidden />
			{!compact && (
				<div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/54">
					<span>{spineNumber !== undefined ? `SPINE #${String(spineNumber).padStart(2, "0")}` : "DUMP"}</span>
					<span className="h-1 w-1 rounded-full bg-white/30" />
				</div>
			)}
			<div className="absolute inset-0 flex items-center justify-center">
				<span
					className={`font-mono font-medium tracking-[-0.06em] text-white/85 transition-transform duration-500 group-hover:scale-[1.04] ${
						compact ? "text-[16px]" : "text-[32px]"
					}`}
					style={{ textShadow: "0 2px 20px rgba(0,0,0,.65)" }}
				>
					{initials}
				</span>
			</div>
			{!compact && (
				<div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 pb-2.5 font-mono text-[11px] uppercase tracking-[0.15em] text-white/72">
					<span className="truncate">{view.platform}</span>
					<span className="tnum text-white/60">{view.year ?? "—"}</span>
				</div>
			)}
			<div className="pointer-events-none absolute inset-0 rounded-[9px] ring-1 ring-inset ring-white/[0.09]" />
		</div>
	);
}

export function SaveButton({
	romId,
	label = true,
}: {
	romId: string;
	label?: boolean;
}) {
	const { saves } = useLibraryState();
	const entry = saves[romId];
	const saved = Boolean(entry);
	const status = entry?.status ?? "saved";
	const meta = STATUS_META[status] ?? STATUS_META.saved;
	return (
		<button
			type="button"
			onClick={() => toggleSave(romId)}
			title={saved ? "Remove from library" : "Save to personal library"}
			aria-label={saved ? "Remove from library" : "Save to library"}
			className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium tracking-[0.04em] transition-all ${
				saved
					? "border-white/30 bg-white text-black"
					: "border-white/[0.12] bg-white/[0.02] text-white/76 hover:border-white/25 hover:text-white"
			}`}
		>
			<span className="text-[11px] leading-none" aria-hidden>
				{saved ? "◆" : "◇"}
			</span>
			{label && <span>{saved ? (status === "saved" ? "Saved" : meta.label) : "Save"}</span>}
		</button>
	);
}

export function StatusPills({ romId, status }: { romId: string; status: LibraryStatus }) {
	return (
		<div className="flex flex-wrap gap-1">
			{STATUS_KEYS.map((key) => {
				const meta = STATUS_META[key];
				const active = status === key;
				return (
					<button
						key={key}
						type="button"
						onClick={() => setStatus(romId, key)}
						className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all ${
							active ? meta.badge : "border-white/[0.1] text-white/52 hover:border-white/20 hover:text-white/65"
						}`}
					>
						{active && <span className={`h-1 w-1 rounded-full ${meta.dot}`} />}
						{meta.short}
					</button>
				);
			})}
		</div>
	);
}

export function PinButton({ romId, pinned }: { romId: string; pinned: boolean }) {
	return (
		<button
			type="button"
			onClick={() => setPinned(romId, !pinned)}
			title={pinned ? "Unpin from top" : "Pin to top of rack"}
			aria-label={pinned ? "Unpin" : "Pin"}
			className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] transition-colors ${
				pinned
					? "border-amber-300/40 bg-amber-300/15 text-amber-200"
					: "border-white/[0.1] text-white/46 hover:border-white/25 hover:text-white/70"
			}`}
		>
			★
		</button>
	);
}

export function RomCard({ view, spineNumber }: { view: RomView; spineNumber?: number }) {
	const { saves } = useLibraryState();
	const entry = saves[view.id];
	const statusInfo = entry ? STATUS_META[entry.status] : null;
	return (
		<div className="group relative flex flex-col gap-2.5 rounded-xl border border-white/[0.1] bg-[#0b0b0f] p-2.5 transition-all duration-300 hover:border-white/[0.18] hover:bg-[#0c0c11]">
			<Link to={`/rom/${view.slug}`} className="relative block">
				<Cover view={view} className="aspect-[4/3] w-full" spineNumber={spineNumber} />
				{entry && entry.status !== "saved" && statusInfo && (
					<span
						className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] backdrop-blur-md ${statusInfo.badge}`}
					>
						<span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
						{statusInfo.short}
					</span>
				)}
			</Link>
			<div className="flex items-start justify-between gap-2 px-0.5 pt-0.5">
				<div className="min-w-0">
					<Link
						to={`/rom/${view.slug}`}
						className="block truncate text-[13px] font-medium tracking-[-0.01em] text-white/90 hover:text-white"
					>
						{view.title}
					</Link>
					<p className="mt-0.5 truncate text-[11px] text-white/58">
						{view.publisher} - {view.platform}
					</p>
				</div>
				<span className="tnum shrink-0 rounded border border-white/[0.11] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[11px] text-white/60">
					{view.year ?? "—"}
				</span>
			</div>
			<div className="flex items-center justify-between border-t border-white/[0.12] px-0.5 pt-2">
				<span className="tnum truncate font-mono text-[11px] uppercase tracking-[0.12em] text-white/48">
					{formatSizeMb(view.sizeMb)}
				</span>
				<div className="flex shrink-0 items-center gap-1.5">
					<Link
						to={`/rom/${view.slug}#curate`}
						title="File into a list"
						className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.11] text-[11px] text-white/62 transition-colors hover:border-white/25 hover:text-white"
					>
						+
					</Link>
					<SaveButton romId={view.id} label={false} />
				</div>
			</div>
		</div>
	);
}
