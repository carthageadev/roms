/**
 * Placeholder while the 3D hero chunk loads: a full seven-cart stack in the
 * same footprint, so the layout never jumps or briefly collapses to three.
 */

import { ShelfCover } from "./ui";
import type { RomView } from "../lib/rom-view";

export default function HeroCartridgesFallback({ views }: { views: RomView[] }) {
	if (views.length === 0) return null;
	const radius = Math.min(3, Math.floor(views.length / 2));
	const visible = views
		.map((view, index) => {
			let offset = index;
			const half = views.length / 2;
			if (offset > half) offset -= views.length;
			if (offset < -half) offset += views.length;
			return { view, offset };
		})
		.filter(({ offset }) => Math.abs(offset) <= radius)
		.sort((a, b) => a.offset - b.offset);

	return (
		<div className="relative mx-auto h-full w-full max-w-[460px]">
			{visible.map(({ view, offset }) => {
				const distance = Math.abs(offset);
				const width = 56 - distance * 6;
				const top = 38 + offset * 12;
				return (
					<div
						key={`${view.id}-${offset}`}
						className="absolute left-1/2"
						style={{
							top: `${top}%`,
							width: `${width}%`,
							zIndex: radius - distance + 1,
							opacity: 1 - distance * 0.2,
							transform: `translateX(-50%) rotate(${offset * 1.1}deg)`,
						}}
					>
						<ShelfCover view={view} className="aspect-[4/3] w-full" />
					</div>
				);
			})}
		</div>
	);
}
