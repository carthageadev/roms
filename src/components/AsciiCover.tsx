import { useMemo } from "react";
import { fnv, rng } from "../lib/hash";
import type { RomEntry } from "../lib/roms";

const SHADES = [" ", "·", "░", "▒", "▓", "█"];

function field(seed: number, width: number, height: number) {
	const random = rng(seed);
	const gridWidth = 5;
	const gridHeight = 4;
	const grid = Array.from({ length: gridHeight + 1 }, () => Array.from({ length: gridWidth + 1 }, () => random()));
	const bias = random() * 0.3;
	const half = Math.ceil(width / 2);
	const output: number[][] = [];
	for (let y = 0; y < height; y++) {
		const row: number[] = [];
		for (let x = 0; x < half; x++) {
			const fx = (x / half) * gridWidth;
			const fy = (y / height) * gridHeight;
			const x0 = Math.floor(fx);
			const y0 = Math.floor(fy);
			const tx = fx - x0;
			const ty = fy - y0;
			const sx = tx * tx * (3 - 2 * tx);
			const sy = ty * ty * (3 - 2 * ty);
			const a = grid[y0][x0];
			const b = grid[y0][x0 + 1];
			const c = grid[y0 + 1][x0];
			const d = grid[y0 + 1][x0 + 1];
			let value = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
			value = Math.pow(value, 1.4) + bias * (1 - Math.abs(y - height / 2) / (height / 2));
			row.push(value);
		}
		const mirrored = [...row].reverse();
		output.push([...row, ...(width % 2 ? mirrored.slice(1) : mirrored)]);
	}
	return output;
}

export function AsciiCover({ rom, size = "md" }: { rom: RomEntry; size?: "sm" | "md" }) {
	const disc = /playstation|dreamcast|gamecube|wii|xbox|3do|sega saturn|ps2/i.test(rom.console);
	const width = disc ? 26 : 24;
	const height = disc ? 13 : 10;
	const cells = useMemo(() => {
		const seed = fnv(rom.id);
		const values = field(seed, width, height);
		const accent = rng(seed ^ 0x9e37)();
		return values.map((row, y) => row.map((value, x) => {
			if (disc) {
				const dx = (x - (width - 1) / 2) / (width / 2);
				const dy = (y - (height - 1) / 2) / (height / 2);
				const distance = Math.sqrt(dx * dx + dy * dy);
				if (distance > 1.02) return { character: " ", accent: false, rim: false };
				if (distance > 0.93) return { character: "▒", accent: false, rim: true };
				if (distance < 0.16) return { character: " ", accent: false, rim: false };
				if (distance < 0.26) return { character: "○", accent: true, rim: false };
			}
			const index = Math.max(0, Math.min(SHADES.length - 1, Math.floor(value * SHADES.length)));
			return { character: SHADES[index], accent: index >= 4 && ((x * 7 + y * 3) % 11) / 11 < accent * 0.6, rim: false };
		}));
	}, [disc, height, rom.id, width]);
	const textSize = size === "sm" ? "text-[8px]" : "text-[10px] sm:text-[11px]";
	const label = `${rom.console || "unknown"} - ${rom.date?.slice(-4) || "—"}`;

	if (disc) {
		return (
			<pre className={`ascii ${textSize} text-neutral-500`}>
				{cells.map((row, y) => <div key={y}>{row.map((cell, x) => <span className={cell.accent ? "text-acc" : cell.rim ? "text-neutral-700" : "text-neutral-400"} key={x}>{cell.character}</span>)}</div>)}
				<div className="mt-1 text-center text-neutral-600">{label.padStart(Math.floor((width + label.length) / 2)).padEnd(width)}</div>
			</pre>
		);
	}

	const top = `╭${"─".repeat(width + 2)}╮`;
	const bottom = `╰┬${"┬".repeat(width)}┬╯`;
	return (
		<pre className={`ascii ${textSize} text-neutral-600`}>
			<div>{top}</div>
			<div>│ <span className="text-neutral-300"> {rom.console || "unknown"} </span>{"─".repeat(Math.max(0, width - (rom.console?.length || 7) - 6))}<span className="text-acc"> ▪▪ </span>│</div>
			<div>│{" ".repeat(width + 2)}│</div>
			{cells.map((row, y) => <div key={y}>│ {row.map((cell, x) => <span className={cell.accent ? "text-acc" : "text-neutral-400"} key={x}>{cell.character}</span>)} │</div>)}
			<div>│{" ".repeat(width + 2)}│</div>
			<div>│ <span className="text-neutral-500">{rom.date?.slice(-4) || "unknown"}</span><span className="text-neutral-700">{crc32Short(rom.id)}</span> │</div>
			<div>{bottom}</div>
		</pre>
	);
}

function crc32Short(id: string): string {
	return id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
}
