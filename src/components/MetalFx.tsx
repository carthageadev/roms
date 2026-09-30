"use client";

import { useEffect, useState } from "react";
import { MetalFx as MetalFxEffect, type MetalFxProps } from "metal-fx";

/** Preserve a useful SSR button, then enable the WebGL frame after hydration. */
export function MetalFx({ children, className, style, paused, ...props }: MetalFxProps) {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    // Mount-only hydration flag for the WebGL frame.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  if (!mounted) return <span className={`metal-ssr-fallback ${className ?? ""}`} style={{ display: "inline-flex", flexShrink: 0, ...style }}>{children}</span>;
  return <MetalFxEffect {...props} className={className} style={style} paused={paused || reducedMotion}>{children}</MetalFxEffect>;
}
