/** Paper-label silhouettes while the shared cartridge model warms up. */
import { labelDataUrl } from "../lib/cover-label";
import type { RomView } from "../lib/rom-view";

export default function HeroCartridgesFallback({
	views,
}: {
	views: RomView[];
}) {
	if (views.length === 0) return null;
	const radius = Math.min(3, Math.floor(views.length / 2));
	return (
		<div aria-hidden="true" className="cartridge-placeholder">
			{views.map((view, index) => {
				const offset = index > views.length / 2 ? index - views.length : index;
				if (Math.abs(offset) > radius) return null;
				const distance = Math.abs(offset);
				return (
					<div
						className="placeholder-cart"
						key={view.id}
						style={{
							top: `${50 + offset * (distance === 1 ? 18 : 13)}%`,
							width: `${distance === 0 ? 43 : 29 - distance * 2}%`,
							zIndex: 4 - distance,
							opacity: 1 - distance * 0.14,
							transform: `translate(-50%, -50%) rotate(-3deg)`,
						}}
					>
						<img alt="" src={labelDataUrl(view)} />
					</div>
				);
			})}
		</div>
	);
}
