/**
 * Generated cartridge labels. Every cartridge shows one of these until real
 * box art arrives from /api/cover. Client-side only (uses a canvas).
 */

const W = 512;
const H = 512;
const cache = new Map<string, string>();

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
    if (lines.length === 2) break;
  }
  if (line && lines.length < 3) lines.push(line);
  return lines.slice(0, 3);
}

function hueOf(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export function labelArt(title: string, platformName: string, aspect = 1): string {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const key = `${platformName}|${title}|${ratio}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const hue = hueOf(title);
  ctx.fillStyle = "#ebe8de";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = `hsl(${hue} 26% 22%)`;
  ctx.fillRect(0, 0, W, 86);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "600 22px 'DM Sans', Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("ROMS.TN", 36, 44);

  ctx.save();
  ctx.beginPath();
  ctx.rect(36, 112, W - 72, 232);
  ctx.clip();
  ctx.fillStyle = `hsl(${hue} 22% 30%)`;
  ctx.fillRect(36, 112, W - 72, 232);
  ctx.strokeStyle = "rgba(235,232,222,0.85)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(W / 2 + ((hue % 40) - 20), 228, 26 + i * 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#ebe8de";
  ctx.beginPath();
  ctx.arc(W / 2 + ((hue % 40) - 20), 228, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#23262c";
  ctx.font = "600 40px 'DM Sans', Arial, sans-serif";
  const lines = wrap(ctx, title, W - 72);
  lines.forEach((line, i) => ctx.fillText(line, 36, 400 + i * 46));

  ctx.fillStyle = "rgba(35,38,44,0.45)";
  ctx.font = "500 18px 'Geist Mono', ui-monospace, monospace";
  ctx.fillText(platformName.toUpperCase().slice(0, 36), 36, H - 40);

  // The label face is not square on any of the models, so crop the art to the
  // same aspect the real covers are baked at instead of letting it stretch.
  if (Math.abs(ratio - 1) > 0.01) {
    const outWidth = Math.round(ratio >= 1 ? W : W * ratio);
    const outHeight = Math.round(ratio >= 1 ? W / ratio : H);
    const out = document.createElement("canvas");
    out.width = outWidth;
    out.height = outHeight;
    const outCtx = out.getContext("2d");
    if (!outCtx) return "";
    outCtx.drawImage(canvas, (W - outWidth) / 2, (H - outHeight) / 2, outWidth, outHeight, 0, 0, outWidth, outHeight);
    const cropped = out.toDataURL("image/png");
    cache.set(key, cropped);
    return cropped;
  }

  const url = canvas.toDataURL("image/png");
  cache.set(key, url);
  return url;
}
