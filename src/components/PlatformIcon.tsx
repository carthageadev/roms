import { Gamepad2, Monitor, CircuitBoard, Grid2X2 } from "lucide-react";

export function PlatformIcon({ platform, size = 17 }: { platform: string; size?: number }) {
  if (platform === "all") return <Grid2X2 size={size} strokeWidth={1.6} />;
  if (platform === "gameboy" || platform === "gb" || platform === "gba") return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4.5" y="2" width="11" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" /><rect x="7" y="4.7" width="6" height="5" rx=".7" stroke="currentColor" strokeWidth="1.2" /><path d="M7 13h3m-1.5-1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="12.5" cy="13.5" r=".8" fill="currentColor" /></svg>;
  if (platform === "playstation" || platform === "ps1") return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5v13.8l-3-1V2l5 1.6c3 .9 3.7 2.6 3.2 4.4-.5 1.6-1.8 2.1-3.2 1.8V5.5c0-.8-.5-1.2-1-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="m6 12-3 1c-2.3.9-2 2 .3 2.7l2.7.8m5-.7 5.8-2c2.4-.8 1.8-1.8-.2-2.4l-2.1-.5-2.6.8" stroke="currentColor" strokeWidth="1.3" /></svg>;
  if (platform === "sega" || platform === "genesis") return <CircuitBoard size={size} strokeWidth={1.5} />;
  if (platform === "n64") return <Monitor size={size} strokeWidth={1.5} />;
  return <Gamepad2 size={size} strokeWidth={1.5} />;
}
