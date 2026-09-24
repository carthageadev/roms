import { crc32, fnv, rng } from "./hash";
import type { RomEntry } from "./roms";

export const ROOT_FILES = ["README", "MANIFEST.txt"];

export interface RomSystem {
	key: string;
	label: string;
	company: string;
	count: number;
	bytes: number;
}

export type RomNode =
	| { kind: "root" }
	| { kind: "dir"; system: RomSystem }
	| { kind: "file"; rom: RomEntry }
	| { kind: "meta"; name: string };

function keyPart(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "misc";
}

export function systemKey(consoleName: string): string {
	return keyPart(consoleName || "Unknown");
}

export function fileName(rom: RomEntry): string {
	return rom.href.split("/").filter(Boolean).at(-1) || rom.id;
}

export function pathForRom(rom: RomEntry): string {
	return `/${systemKey(rom.console)}/${fileName(rom)}`;
}

export function buildSystems(roms: RomEntry[]): RomSystem[] {
	const systems = new Map<string, RomSystem>();
	for (const rom of roms) {
		const key = systemKey(rom.console);
		const current = systems.get(key);
		if (current) {
			current.count += 1;
			current.bytes += rom.sizeBytes || 0;
			if (!current.company && rom.company) current.company = rom.company;
		} else {
			systems.set(key, {
				key,
				label: rom.console || "Unknown",
				company: rom.company || "Unknown",
				count: 1,
				bytes: rom.sizeBytes || 0,
			});
		}
	}
	return [...systems.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function dirOf(roms: RomEntry[], key: string): RomEntry[] {
	return roms.filter((rom) => systemKey(rom.console) === key).sort((a, b) => fileName(a).localeCompare(fileName(b)));
}

export function fmtSize(bytes: number): string {
	if (bytes >= 1 << 30) return `${(bytes / (1 << 30)).toFixed(1)}G`;
	if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(bytes >= 10 << 20 ? 0 : 1)}M`;
	return `${Math.max(1, Math.round(bytes / 1024))}K`;
}

export function fmtBytes(bytes: number): string {
	return bytes.toLocaleString("en-US");
}

function displayDate(rom: RomEntry): string {
	const match = rom.date?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
	return match ? `${match[3]}-${match[2]}-${match[1]} 00:00` : rom.date || "unknown";
}

export function mtime(rom: RomEntry): string {
	return displayDate(rom);
}

export function normalizePath(cwd: string, arg?: string): string {
	if (!arg || arg === "." || arg === "~") return arg === "~" ? "/" : cwd;
	const path = arg.startsWith("/") ? arg : `${cwd === "/" ? "" : cwd}/${arg}`;
	const output: string[] = [];
	for (const part of path.split("/")) {
		if (!part || part === ".") continue;
		if (part === "..") output.pop();
		else output.push(part);
	}
	return `/${output.join("/")}`;
}

export function resolve(roms: RomEntry[], systems: RomSystem[], path: string): RomNode | null {
	const parts = path.split("/").filter(Boolean);
	if (!parts.length) return { kind: "root" };
	const [head, ...rest] = parts;
	if (!rest.length && ROOT_FILES.some((file) => file.toLowerCase() === head.toLowerCase())) {
		return { kind: "meta", name: ROOT_FILES.find((file) => file.toLowerCase() === head.toLowerCase())! };
	}
	const system = systems.find((item) => item.key === head.toLowerCase());
	if (!system) return null;
	if (!rest.length) return { kind: "dir", system };
	if (rest.length > 1) return null;
	const wanted = rest[0].toLowerCase();
	const rom = dirOf(roms, system.key).find((item) => fileName(item).toLowerCase() === wanted);
	return rom ? { kind: "file", rom } : null;
}

export function completions(roms: RomEntry[], systems: RomSystem[], cwd: string, fragment: string): string[] {
	const absolute = fragment.startsWith("/");
	const slash = fragment.lastIndexOf("/");
	const dirPart = slash >= 0 ? fragment.slice(0, slash + 1) : "";
	const leaf = (slash >= 0 ? fragment.slice(slash + 1) : fragment).toLowerCase();
	const base = normalizePath(cwd, dirPart || ".");
	const node = resolve(roms, systems, base);
	let names: string[] = [];
	if (node?.kind === "root") names = [...systems.map((system) => `${system.key}/`), ...ROOT_FILES];
	if (node?.kind === "dir") names = dirOf(roms, node.system.key).map(fileName);
	return names
		.filter((name) => name.toLowerCase().startsWith(leaf))
		.map((name) => (absolute || dirPart ? dirPart + name : name));
}

export function commonPrefix(items: string[]): string {
	if (!items.length) return "";
	let prefix = items[0];
	for (const item of items) {
		while (!item.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1);
	}
	return prefix;
}

function magicFor(rom: RomEntry): number[] {
	const value = `${rom.console} ${rom.company}`.toLowerCase();
	if (value.includes("nintendo 64")) return [0x80, 0x37, 0x12, 0x40, 0x00, 0x00, 0x0f, 0x80];
	if (value.includes("game boy")) return [0xc3, 0x50, 0x01, 0xce, 0xed, 0x66, 0x66, 0xcc];
	if (value.includes("famicom") || value.includes("nes")) return [0x4e, 0x45, 0x53, 0x1a, 0x10, 0x10, 0x40, 0x08];
	if (value.includes("playstation")) return [0x50, 0x53, 0x2d, 0x58, 0x20, 0x45, 0x58, 0x45];
	return [0xff, 0xff, 0x00, 0x00, 0x78, 0x9c, 0x0b, 0x00];
}

export function romBytes(rom: RomEntry, offset: number, length: number): number[] {
	const magic = magicFor(rom);
	const title = rom.title.toUpperCase().slice(0, 21);
	const output: number[] = [];
	for (let index = offset; index < offset + length; index++) {
		if (index < magic.length) output.push(magic[index]);
		else if (index >= 0x20 && index < 0x20 + title.length) output.push(title.charCodeAt(index - 0x20));
		else if (index >= 0x20 + title.length && index < 0x30) output.push(0);
		else output.push(Math.floor(rng(fnv(`${rom.id}:${index >> 4}`) + index * 2654435761)() * 256) & 0xff);
	}
	return output;
}

export function hexdump(rom: RomEntry, lines: number, from = 0): string[] {
	const rows: string[] = [];
	for (let line = 0; line < lines; line++) {
		const offset = from + line * 16;
		const bytes = romBytes(rom, offset, 16);
		const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0"));
		const left = hex.slice(0, 8).join(" ");
		const right = hex.slice(8).join(" ");
		const ascii = bytes.map((byte) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : ".")).join("");
		rows.push(`${offset.toString(16).padStart(8, "0")}  ${left}  ${right}  |${ascii}|`);
	}
	return rows;
}

export function totalBytes(roms: RomEntry[]): number {
	return roms.reduce((sum, rom) => sum + (rom.sizeBytes || 0), 0);
}

export function recordId(rom: RomEntry): string {
	return crc32(rom.id);
}
