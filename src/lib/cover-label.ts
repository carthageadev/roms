/**
 * Generated cartridge labels.
 *
 * The shared index carries no artwork, so hero cartridges wear a label drawn
 * on a canvas: the record's stable hue, its initials, and its title. This is
 * the default path and costs zero network requests. Real box art (see
 * `./cover-art`) only replaces these when the user configures their own
 * ScreenScraper keys, and only for the hero list.
 */

import type { RomView } from "./rom-view";

const LABEL_W = 512;
const LABEL_H = 640;

const labelCache = new Map<string, string>();

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
		if (lines.length === 3) break;
	}
	if (line) lines.push(line);
	return lines.slice(0, 3);
}

/** Data URL for a printable label, cached per record id. */
export function labelDataUrl(view: RomView): string {
	const cached = labelCache.get(view.id);
	if (cached) return cached;

	const canvas = document.createElement("canvas");
	canvas.width = LABEL_W;
	canvas.height = LABEL_H;
	const ctx = canvas.getContext("2d");
	if (!ctx) return "";

	const gradient = ctx.createLinearGradient(0, 0, LABEL_W, LABEL_H);
	gradient.addColorStop(0, `hsl(${view.hue} 44% 26%)`);
	gradient.addColorStop(0.68, `hsl(${(view.hue + 40) % 360} 32% 10%)`);
	gradient.addColorStop(1, "#0a0a0b");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, LABEL_W, LABEL_H);

	// Diagonal sheen, same language as the 2D covers.
	ctx.save();
	ctx.translate(LABEL_W / 2, LABEL_H / 2);
	ctx.rotate(-0.32);
	ctx.fillStyle = "rgba(255,255,255,0.07)";
	ctx.fillRect(-LABEL_W, -LABEL_H * 0.08, LABEL_W * 2, LABEL_H * 0.16);
	ctx.restore();

	// Initials.
	ctx.fillStyle = "rgba(255,255,255,0.92)";
	ctx.font = "600 150px 'Geist Sans', system-ui, sans-serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(view.initials, LABEL_W / 2, LABEL_H * 0.36);

	// Title block.
	ctx.textBaseline = "alphabetic";
	const maxWidth = LABEL_W - 96;
	ctx.font = "600 44px 'Geist Sans', system-ui, sans-serif";
	const lines = wrapText(ctx, view.title, maxWidth);
	ctx.fillStyle = "#ffffff";
	const startY = LABEL_H - 170 - (lines.length - 1) * 26;
	lines.forEach((line, i) => {
		ctx.fillText(line, LABEL_W / 2, startY + i * 52, maxWidth);
	});

	// Platform + year strip.
	ctx.font = "500 26px 'Geist Mono', ui-monospace, monospace";
	ctx.fillStyle = "rgba(255,255,255,0.6)";
	const strip = `${view.platform} - ${view.year ?? "-"}`.toUpperCase();
	ctx.fillText(strip.slice(0, 34), LABEL_W / 2, LABEL_H - 72, maxWidth);

	// Spine rule.
	ctx.fillStyle = "rgba(255,255,255,0.22)";
	ctx.fillRect(48, 48, LABEL_W - 96, 3);

	const url = canvas.toDataURL("image/png");
	labelCache.set(view.id, url);
	return url;
}
