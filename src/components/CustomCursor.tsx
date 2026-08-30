import { gsap } from "gsap";
import { useEffect, useRef } from "react";

export function CustomCursor() {
	const cursorRef = useRef<HTMLDivElement>(null);
	const followerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const cursor = cursorRef.current;
		const follower = followerRef.current;
		if (!cursor || !follower) return;

		const onMouseMove = (e: MouseEvent) => {
			gsap.to(cursor, {
				x: e.clientX,
				y: e.clientY,
				duration: 0.1,
				ease: "power2.out",
			});
			gsap.to(follower, {
				x: e.clientX,
				y: e.clientY,
				duration: 0.8,
				ease: "expo.out",
			});
		};

		window.addEventListener("mousemove", onMouseMove);

		return () => {
			window.removeEventListener("mousemove", onMouseMove);
		};
	}, []);

	return (
		<>
			<div
				aria-hidden="true"
				className="pointer-events-none fixed top-0 left-0 z-[9999] hidden h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white md:block"
				ref={cursorRef}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none fixed top-0 left-0 z-[9998] hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 md:block"
				ref={followerRef}
				style={{ backdropFilter: "blur(1px)" }}
			/>
		</>
	);
}
