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

function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
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

	// Printed paper, not a fake cover lookup or a giant initials placeholder.
	ctx.fillStyle = "#e4e1d5";
	ctx.fillRect(0, 0, LABEL_W, LABEL_H);
	const ink = `hsl(${view.hue} 18% 25%)`;
	ctx.fillStyle = ink;
	ctx.fillRect(0, 0, LABEL_W, 18);
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
	ctx.font = "500 18px 'Geist Mono', ui-monospace, monospace";
	ctx.fillText("ROMS.TN / THE CLASSICS", 38, 67);

	// A quiet geometric print, unique to each real index record.
	ctx.save();
	ctx.beginPath();
	ctx.rect(38, 100, LABEL_W - 76, 247);
	ctx.clip();
	ctx.fillStyle = ink;
	ctx.fillRect(38, 100, LABEL_W - 76, 247);
	ctx.strokeStyle = "#e4e1d5";
	ctx.lineWidth = 1.5;
	for (let i = 0; i < 8; i++) {
		ctx.beginPath();
		ctx.arc(155 + (view.hue % 70), 224, 37 + i * 21, -Math.PI, Math.PI);
		ctx.stroke();
	}
	ctx.fillStyle = "#e4e1d5";
	ctx.beginPath();
	ctx.arc(155 + (view.hue % 70), 224, 25, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	const title = view.title.replace(/\s*\([^)]*\)/g, "").replace(/, The\b/, "");
	ctx.font = "500 44px 'Geist Sans', system-ui, sans-serif";
	const maxWidth = LABEL_W - 76;
	const lines = wrapText(ctx, title, maxWidth);
	ctx.fillStyle = "#282c26";
	const startY = 409;
	lines.forEach((line, i) => {
		ctx.fillText(line, 38, startY + i * 51, maxWidth);
	});
	ctx.fillStyle = "#282c263a";
	ctx.fillRect(38, 553, maxWidth, 1);
	ctx.font = "400 17px 'Geist Mono', ui-monospace, monospace";
	ctx.fillStyle = "#5f6658";
	ctx.fillText(view.platform.toUpperCase(), 38, 588, maxWidth);

	const url = canvas.toDataURL("image/png");
	labelCache.set(view.id, url);
	return url;
}
