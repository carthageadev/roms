export function PixelIcon({ className = "h-20 w-28" }: { className?: string }) {
	return (
		<svg aria-hidden="true" className={className} fill="none" shapeRendering="crispEdges" viewBox="0 0 96 72" xmlns="http://www.w3.org/2000/svg">
			<rect fill="#111111" height="48" rx="5" stroke="#ffb000" strokeWidth="4" width="84" x="6" y="14" />
			<rect fill="#ffb000" fillOpacity="0.16" height="10" width="60" x="18" y="21" />
			<rect fill="#ffb000" fillOpacity="0.9" height="14" width="24" x="16" y="27" />
			<circle cx="59" cy="34" r="8" stroke="#ffb000" strokeWidth="4" />
			<circle cx="59" cy="34" r="2" fill="#ffb000" />
			<path d="M18 50H78" stroke="#ffb000" strokeWidth="4" />
			<path d="M24 58H34M40 58H50M56 58H66" stroke="#ffb000" strokeWidth="3" />
		</svg>
	);
}
