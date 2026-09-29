/**
 * Placeholder while the 3D hero chunk loads: three stacked generated covers
 * in the same footprint, so the layout never jumps.
 */

import { ShelfCover } from "./ui";
import type { RomView } from "../lib/rom-view";

export default function HeroCartridgesFallback({ views }: { views: RomView[] }) {
	const [a, b, c] = views;
	if (!a) return null;
	return (
		<div className="relative mx-auto h-full w-full max-w-[460px]">
			{c && (
				<div className="absolute top-[16%] left-[4%] w-[52%] rotate-[-9deg] opacity-60">
					<ShelfCover view={c} className="aspect-[4/3] w-full" />
				</div>
			)}
			{b && (
				<div className="absolute top-[36%] right-[3%] w-[54%] rotate-[7deg] opacity-80">
					<ShelfCover view={b} className="aspect-[4/3] w-full" />
				</div>
			)}
			<div className="absolute top-[4%] left-1/2 w-[62%] -translate-x-1/2">
				<ShelfCover view={a} className="aspect-[4/3] w-full" />
			</div>
		</div>
	);
}
