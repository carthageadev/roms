import {
	ROOT_FILES,
	buildSystems,
	dirOf,
	fileName,
	fmtBytes,
	fmtSize,
	hexdump,
	mtime,
	normalizePath,
	pathForRom,
	resolve,
	totalBytes,
	type RomSystem,
} from "./fs";
import { searchRoms } from "./roms";
import type { RomEntry } from "./roms";

export type Tone = "fg" | "dim" | "amber" | "bright" | "err" | "inv";
export interface Seg { t: string; c?: Tone }
export type Line = Seg[];

export const s = (text: string, color?: Tone): Seg => ({ t: text, c: color });
export const line = (...segments: (Seg | string)[]): Line => segments.map((item) => typeof item === "string" ? s(item) : item);
export const blank: Line = [];

export interface ShellResult {
	lines: Line[];
	cwd?: string;
	clear?: boolean;
}

export interface ShellCtx {
	roms: RomEntry[];
	systems: RomSystem[];
	cwd: string;
	history: string[];
}

const pad = (value: string | number, length: number) => String(value).padEnd(length);
const padLeft = (value: string | number, length: number) => String(value).padStart(length);
const column = (value: string, length: number) => (value.length > length ? `${value.slice(0, length - 1)}~` : value.padEnd(length)) + " ";

function fileRow(rom: RomEntry, showDirectory = false): Line {
	return line(
		s("-r--r--r--", "dim"),
		s("  1 roms.tn index ", "dim"),
		s(padLeft(fmtSize(rom.sizeBytes || 0), 6), "fg"),
		s(`  ${mtime(rom)}  `, "dim"),
		s(showDirectory ? pathForRom(rom) : fileName(rom), "amber"),
	);
}

function directoryRow(system: RomSystem): Line {
	return line(
		s("dr-xr-xr-x", "dim"),
		s(` ${padLeft(system.count, 3)} roms.tn index `, "dim"),
		s(padLeft(fmtSize(system.bytes), 6), "fg"),
		s("  shared weekly build  ", "dim"),
		s(`${system.key}/`, "bright"),
		s(`   ${system.label} [${system.company}]`, "dim"),
	);
}

function notFound(command: string, argument: string): Line[] {
	return [line(s(`${command}: ${argument}: No such file or directory`, "err"))];
}

function recordLines(rom: RomEntry): Line[] {
	const row = (key: string, value: string, color: Tone = "fg") => line(s(pad(key, 12), "dim"), s(value, color));
	return [
		line(s(rom.title, "bright")),
		blank,
		row("path", pathForRom(rom), "amber"),
		row("system", rom.console || "Unknown"),
		row("maker", rom.company || "Unknown"),
		row("size", `${fmtBytes(rom.sizeBytes || 0)} bytes (${fmtSize(rom.sizeBytes || 0)})`),
		row("date", rom.date || "Unknown"),
		row("source url", rom.url, "amber"),
		row("record id", rom.id),
		blank,
		line(s("index header:", "dim")),
		...hexdump(rom, 3).map((value) => line(s(value, "dim"))),
		blank,
		line(s("* shared Atlas record. no ROM files are stored or served here.", "dim")),
	];
}

const HELP: [string, string][] = [
	["ls [path]", "list directory (systems at /)"],
	["cd <path>", "change directory  ..  /  nintendo-64"],
	["find <query>", "search the shared index"],
	["grep <pat>", "regex match on title/company/system"],
	["cat <file>", "print full record"],
	["stat <file>", "one-line metadata"],
	["xxd <file>", "synthetic header hexdump"],
	["tree", "system index, compressed"],
	["du", "size per system"],
	["random", "open a random record"],
	["history", "recent commands"],
	["clear", "wipe scrollback  (ctrl-l)"],
	["help", "this"],
];

const QUERY_HINT: Line[] = [
	line(s("query syntax: ", "dim"), s("p:n64  c:nintendo  y:199x  y:>1998", "amber")),
	line(s("              ", "dim"), s("plain text searches title, maker, system and path", "dim")),
];

function resultRows(query: string, roms: RomEntry[], limit = 40): Line[] {
	const result = searchRoms(roms, query);
	if (!result.hits.length) return [line(s(`no matches for "${query}"`, "err"))];
	const shown = result.hits.slice(0, limit);
	const rows = shown.map((hit) => {
		const rom = hit.rom;
		return line(
			s(column(rom.title, 42), "fg"),
			s(`${rom.date?.slice(-4) ?? "----"} `, "dim"),
			s(column(rom.company || "unknown", 18), "dim"),
			s("  /" + pathForRom(rom).slice(1), "amber"),
		);
	});
	const footer = line(
		s(`${result.hits.length} match${result.hits.length === 1 ? "" : "es"}`, "dim"),
		s(result.hits.length > limit ? ` (showing ${limit})` : "", "dim"),
		s(`  ${result.ms.toFixed(2)}ms`, "dim"),
	);
	return [...rows, blank, footer];
}

export function runCommand(input: string, context: ShellCtx): ShellResult {
	const raw = input.trim();
	if (!raw) return { lines: [] };
	const [command, ...rest] = raw.split(/\s+/);
	const argument = rest.join(" ");
	const name = command.toLowerCase();
	const { cwd, roms, systems } = context;

	const openFile = (label: string): ShellResult | null => {
		const node = resolve(roms, systems, normalizePath(cwd, argument));
		if (node?.kind === "file") return { lines: recordLines(node.rom) };
		if (node?.kind === "dir") return { lines: [line(s(`${label}: ${argument}: Is a directory`, "err"))] };
		return null;
	};

	switch (name) {
		case "help":
		case "?":
		case "man":
			return {
				lines: [
					line(s("roms.tn", "bright"), s(" — shared ROM index. commands:", "dim")),
					blank,
					...HELP.map(([key, value]) => line(s(`  ${pad(key, 16)}`, "amber"), s(value, "dim"))),
					blank,
					...QUERY_HINT,
					blank,
					line(s("  type anything else to search as you type. ", "dim"), s("↑↓", "fg"), s(" pick  ", "dim"), s("enter", "fg"), s(" open  ", "dim"), s("tab", "fg"), s(" complete", "dim")),
				],
			};
		case "ls":
		case "ll":
		case "dir": {
			const target = normalizePath(cwd, rest.find((item) => !item.startsWith("-")));
			const node = resolve(roms, systems, target);
			if (!node) return { lines: notFound("ls", argument) };
			if (node.kind === "file") return { lines: [fileRow(node.rom)] };
			if (node.kind === "meta") return { lines: [line(s(node.name, "amber"))] };
			if (node.kind === "root") {
				const lines: Line[] = [line(s(`total ${systems.length + ROOT_FILES.length}`, "dim"))];
				for (const system of systems) lines.push(directoryRow(system));
				lines.push(blank, line(s("source: http://92.35.124.13 · weekly Atlas build", "dim")));
				return { lines };
			}
			const games = dirOf(roms, node.system.key);
			return {
				lines: [
					line(s(`total ${games.length}`, "dim"), s(`   ${node.system.label} [${node.system.company}]`, "dim")),
					...games.map((rom) => fileRow(rom)),
				],
			};
		}
		case "cd": {
			if (!argument || argument === "~" || argument === "-") return { lines: [], cwd: "/" };
			const target = normalizePath(cwd, argument);
			const node = resolve(roms, systems, target);
			if (!node) return { lines: notFound("cd", argument) };
			if (node.kind === "file" || node.kind === "meta") return { lines: [line(s(`cd: ${argument}: Not a directory`, "err"))] };
			return { lines: [], cwd: target };
		}
		case "pwd":
			return { lines: [line(s(cwd, "fg"))] };
		case "find":
		case "search":
		case "s":
			return { lines: argument ? resultRows(argument, roms) : [line(s("usage: find <query>", "dim")), ...QUERY_HINT] };
		case "grep": {
			const flags = rest.filter((item) => item.startsWith("-"));
			const pattern = rest.filter((item) => !item.startsWith("-")).join(" ");
			if (!pattern) return { lines: [line(s("usage: grep [-i] <regex>", "dim"))] };
			let expression: RegExp;
			try {
				expression = new RegExp(pattern, flags.includes("-i") ? "i" : "");
			} catch {
				return { lines: [line(s(`grep: ${pattern}: invalid regex`, "err"))] };
			}
			const scope = resolve(roms, systems, cwd);
			const pool = scope?.kind === "dir" ? dirOf(roms, scope.system.key) : roms;
			const hits = pool.filter((rom) => expression.test(rom.title) || expression.test(rom.company) || expression.test(rom.console));
			if (!hits.length) return { lines: [line(s("grep: no match", "dim"))] };
			return { lines: hits.slice(0, 100).map((rom) => line(s(column(rom.title, 42), "fg"), s(column(rom.company, 18), "dim"), s("/" + pathForRom(rom).slice(1), "amber"))) };
		}
		case "cat":
		case "open":
		case "less":
		case "more": {
			if (!argument) return { lines: [line(s(`usage: ${name} <file>`, "dim"))] };
			const node = resolve(roms, systems, normalizePath(cwd, argument));
			if (node?.kind === "meta") {
				if (node.name === "README") {
					return {
						lines: [
							line(s("ROMS.TN — shared ROM index", "bright")),
							blank,
							line(s("This terminal reads the weekly Atlas build.", "fg")),
							line(s("The frontend does not scrape, host, or serve ROM files.", "fg")),
							line(s("Use filters like p:n64, c:nintendo, or y:199x.", "fg")),
							blank,
							line(s(`${roms.length.toLocaleString()} records / ${systems.length} systems / ${fmtSize(totalBytes(roms))} indexed`, "dim")),
							line(s("Source: http://92.35.124.13", "dim")),
						],
					};
				}
				return { lines: [line(s("# MANIFEST", "dim")), ...systems.map((system) => line(s(pad(system.key, 18), "amber"), s(pad(`${system.count} files`, 12), "fg"), s(`${system.label} [${system.company}]`, "dim")))] };
			}
			return openFile(name) ?? { lines: notFound(name, argument) };
		}
		case "stat": {
			if (!argument) return { lines: [line(s("usage: stat <file>", "dim"))] };
			const node = resolve(roms, systems, normalizePath(cwd, argument));
			if (node?.kind !== "file") return { lines: notFound("stat", argument) };
			const rom = node.rom;
			return {
				lines: [
					line(s("  File: ", "dim"), s(pathForRom(rom), "amber")),
					line(s("  Size: ", "dim"), s(pad(fmtBytes(rom.sizeBytes || 0), 14), "fg"), s("Blocks: ", "dim"), s(pad(String(Math.ceil((rom.sizeBytes || 0) / 512)), 10), "fg"), s("regular index record", "dim")),
					line(s("Access: ", "dim"), s("(0444/-r--r--r--)  ", "fg"), s("Uid: (1000/roms)  Gid: (1000/index)", "dim")),
					line(s("Modify: ", "dim"), s(mtime(rom), "fg")),
					line(s(" Source: ", "dim"), s("shared Atlas weekly build", "fg")),
				],
			};
		}
		case "xxd":
		case "hexdump":
		case "hd": {
			if (!argument) return { lines: [line(s("usage: xxd <file>", "dim"))] };
			const node = resolve(roms, systems, normalizePath(cwd, argument));
			if (node?.kind !== "file") return { lines: notFound("xxd", argument) };
			return { lines: [...hexdump(node.rom, 12).map((value) => line(s(value, "fg"))), line(s("...", "dim")), line(s(`${fmtBytes(node.rom.sizeBytes || 0)} bytes indexed / synthetic header`, "dim"))] };
		}
		case "tree": {
			const lines: Line[] = [line(s("/", "bright"))];
			for (const [index, system] of systems.entries()) {
				const last = index === systems.length - 1;
				lines.push(line(s(last ? "└── " : "├── ", "dim"), s(`${system.key}/`, "bright"), s(`  ${system.count} records  ${fmtSize(system.bytes)}`, "dim")));
				for (const [itemIndex, rom] of dirOf(roms, system.key).slice(0, 3).entries()) {
					const leaf = itemIndex === 2 && system.count <= 3;
					lines.push(line(s(last ? "    " : "│   ", "dim"), s(leaf ? "└── " : "├── ", "dim"), s(fileName(rom), "amber")));
				}
				if (system.count > 3) lines.push(line(s(last ? "    " : "│   ", "dim"), s("└── ", "dim"), s(`… ${system.count - 3} more`, "dim")));
			}
			lines.push(blank, line(s(`${systems.length} directories, ${roms.length} records`, "dim")));
			return { lines };
		}
		case "du": {
			const rows = systems.map((system) => {
				const bytes = system.bytes;
				const span = Math.log10(Math.max(bytes, 1)) - 5.5;
				const bar = "#".repeat(Math.max(1, Math.round(span * 9)));
				return line(s(padLeft(fmtSize(bytes), 6), "fg"), s(`  ${pad(system.key, 18)}`, "amber"), s(bar, "dim"));
			});
			return { lines: [...rows, blank, line(s(padLeft(fmtSize(totalBytes(roms)), 6), "bright"), s("  total", "dim"))] };
		}
		case "random": {
			if (!roms.length) return { lines: [line(s("index is empty", "err"))] };
			return { lines: recordLines(roms[Math.floor(Math.random() * roms.length)]) };
		}
		case "history":
			return { lines: context.history.length ? context.history.slice(-20).map((value, index) => line(s(padLeft(index + 1, 4) + "  ", "dim"), s(value, "fg"))) : [line(s("no history", "dim"))] };
		case "clear":
		case "cls":
			return { lines: [], clear: true };
		case "whoami":
			return { lines: [line(s("visitor", "fg"))] };
		case "uname":
			return { lines: [line(s("roms.tn / shared Atlas index / source: http://92.35.124.13", "fg"))] };
		case "date":
			return { lines: [line(s(new Date().toString(), "fg"))] };
		case "echo":
			return { lines: [line(s(argument, "fg"))] };
		case "rm":
		case "mv":
		case "touch":
		case "mkdir":
			return { lines: [line(s(`${name}: filesystem commands are disabled in the index`, "err"))] };
		case "sudo":
			return { lines: [line(s("roms.tn is an index. this incident has been logged.", "err"))] };
		case "exit":
		case "quit":
			return { lines: [line(s("there is no exit. try ", "dim"), s("clear", "amber"), s(".", "dim"))] };
		default:
			return { lines: resultRows(raw, roms) };
	}
}

export const COMMANDS = [
	"help", "ls", "cd", "pwd", "find", "grep", "cat", "stat", "xxd", "hexdump",
	"tree", "du", "random", "history", "clear", "whoami", "uname", "date", "echo", "man", "open",
];

export const TAKES_PATH = new Set(["ls", "ll", "cd", "cat", "open", "stat", "xxd", "hexdump", "hd", "less", "more", "dir"]);

export { buildSystems, pathForRom };
