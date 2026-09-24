import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { buildSystems, completions, commonPrefix, fileName, fmtSize, pathForRom, type RomSystem } from "../lib/fs";
import { loadRomIndex, type RomEntry, searchRoms, type RomHit } from "../lib/roms";
import { COMMANDS, TAKES_PATH, blank, line, runCommand, s, type Line, type Seg, type Tone } from "../lib/shell";

const TONE: Record<Tone, string> = {
	fg: "text-fg",
	dim: "text-dim",
	amber: "text-amber",
	bright: "text-white",
	err: "text-err",
	inv: "bg-amber text-black",
};

function Row({ segs, inverse }: { segs: Line; inverse?: boolean }) {
	if (!segs.length) return <div className="pre">&nbsp;</div>;
	return (
		<div className={`pre ${inverse ? "bg-amber text-black" : ""}`}>
			{segs.map((segment, index) => (
				<span className={inverse ? "" : segment.c ? TONE[segment.c] : TONE.fg} key={index}>{segment.t}</span>
			))}
		</div>
	);
}

interface Block {
	id: number;
	cwd?: string;
	input?: string;
	lines: Line[];
}

const BANNER = [
	"                          _         ",
	"                         | |        ",
	" _ __ ___  _ __ ___  ___ | |_ _ __  ",
	"| '__/ _ \\| '_ ` _ \\/ __|| __| '_ \\ ",
	"| | | (_) | | | | | \\__ \\| |_| | | |",
	"|_|  \\___/|_| |_| |_|___(_)__|_| |_|",
	"                                    ",
	"                                    ",
	"------------------",
];

const pad = (value: string | number, length: number) => String(value).padEnd(length);
const fit = (value: string, length: number) => (value.length > length ? `${value.slice(0, length - 1)}~` : value.padEnd(length));
const MAX_BROWSE = 200;

function highlight(title: string, marked: boolean[], base: Tone = "fg"): Seg[] {
	const output: Seg[] = [];
	for (let index = 0; index < title.length; index++) {
		const color: Tone = marked[index] ? "amber" : base;
		const previous = output[output.length - 1];
		if (previous && previous.c === color) previous.t += title[index];
		else output.push({ t: title[index], c: color });
	}
	return output;
}

function bootLines(status: string, dataSource: string, roms: RomEntry[], systems: RomSystem[], error: string | null): Line[] {
	const base: Line[] = [
		...BANNER.map((value) => line(s(value, "amber"))),
		blank,
		line(s("ROMS TN 1.0", "bright")),
	];
	if (error) {
		return [...base, line(s(`STATUS: INDEX ERROR - ${error}`, "err")), blank, line(s("retry after checking the data source", "dim"))];
	}
	if (!roms.length) {
		return [...base, line(s(`STATUS: ${status}`, "dim")), blank, line(s("the search prompt will unlock when the shared index is ready", "dim")), blank];
	}
	return [
		...base,
		line(s("STATUS: INDEX READY - DATA LOADED", "bright")),
		line(s(`DATA: ${dataSource}`, "dim")),
		line(s(`${roms.length.toLocaleString()} records / ${systems.length} systems / ${fmtSize(roms.reduce((sum, rom) => sum + (rom.sizeBytes || 0), 0))} indexed`, "dim")),
		line(s("source: http://92.35.124.13 - weekly build - source links open externally", "dim")),
		line(s("no scraper in this frontend - ROM files are not committed here", "dim")),
		blank,
		line(s("type ", "dim"), s("help", "amber"), s(" - ", "dim"), s("ls", "amber"), s(" - or start typing a game name", "dim")),
		blank,
	];
}

export function Term() {
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [booted, setBooted] = useState(0);
	const [roms, setRoms] = useState<RomEntry[]>([]);
	const [systems, setSystems] = useState<RomSystem[]>([]);
	const [status, setStatus] = useState("connecting to data index");
	const [dataSource, setDataSource] = useState("waiting for index");
	const [loadError, setLoadError] = useState<string | null>(null);
	const [cwd, setCwd] = useState("/");
	const [input, setInput] = useState(() => {
		try {
			return new URLSearchParams(window.location.search).get("q") ?? "";
		} catch {
			return "";
		}
	});
	const [caret, setCaret] = useState(input.length);
	const [sel, setSel] = useState(-1);
	const [browse, setBrowse] = useState<RomHit[] | null>(null);
	const [returnQuery, setReturnQuery] = useState("");
	const [returnHits, setReturnHits] = useState<RomHit[]>([]);
	const [histIndex, setHistIndex] = useState(-1);
	const [focused, setFocused] = useState(true);
	const inputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const browseItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const historyRef = useRef<string[]>([]);
	const nextId = useRef(1);
	const draft = useRef("");
	const keyboardMove = useRef(false);

	useEffect(() => {
		let cancelled = false;
		loadRomIndex((message) => {
			if (!cancelled) setStatus(message);
		})
			.then((index) => {
				if (cancelled) return;
				setRoms(index.roms);
				setSystems(buildSystems(index.roms));
				setDataSource(index.source === "cache" ? "cached data loaded - no new index update" : "new data fetched from source");
				setStatus("index ready - data loaded");
			})
			.catch((error: unknown) => {
				if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const lines = useMemo(() => bootLines(status, dataSource, roms, systems, loadError), [dataSource, loadError, roms, status, systems]);
	useEffect(() => {
		if (booted >= lines.length) return;
		const timer = window.setTimeout(() => setBooted((value) => value + 1), booted === 0 ? 60 : 45);
		return () => window.clearTimeout(timer);
	}, [booted, lines.length]);

	const trimmed = input.trim();
	const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
	const isCommand = COMMANDS.includes(firstWord) || TAKES_PATH.has(firstWord);
	const liveQuery = /^(find|search|s)\s+/i.test(trimmed) ? trimmed.replace(/^\S+\s+/, "") : isCommand ? "" : trimmed;
	const live = useMemo(() => (liveQuery && roms.length ? searchRoms(roms, liveQuery) : null), [liveQuery, roms]);
	const liveHits = live?.hits ?? [];
	const shown = liveHits.slice(0, 8);

	useEffect(() => {
		if (liveQuery && liveHits.length) {
			setReturnQuery(liveQuery);
			setReturnHits(liveHits);
		}
	}, [liveHits, liveQuery]);

	useEffect(() => {
		const length = browse?.length ?? shown.length;
		setSel((value) => (value >= length ? length - 1 : value));
	}, [browse, shown.length]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			const url = new URL(window.location.href);
			if (liveQuery) url.searchParams.set("q", liveQuery);
			else url.searchParams.delete("q");
			window.history.replaceState(null, "", url.toString());
			document.title = liveQuery ? `${liveQuery} — ROMS TN` : "ROMS TN — game index";
		}, 200);
		return () => window.clearTimeout(timer);
	}, [liveQuery]);

	useLayoutEffect(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, [blocks, booted, shown.length]);

	useLayoutEffect(() => {
		if (!keyboardMove.current) return;
		if (browse) browseItemRefs.current[sel]?.scrollIntoView({ block: "nearest" });
		keyboardMove.current = false;
	}, [browse, sel]);

	const focus = useCallback(() => {
		const selection = window.getSelection();
		if (selection && selection.toString().length) return;
		inputRef.current?.focus();
	}, []);

	useEffect(() => {
		focus();
	}, [focus]);

	const push = useCallback((block: Omit<Block, "id">) => {
		setBlocks((previous) => [...previous, { ...block, id: nextId.current++ }]);
	}, []);

	const restoreSearch = useCallback(() => {
		if (returnHits.length) {
			setInput(returnQuery);
			setCaret(returnQuery.length);
			setBrowse(returnHits.slice(0, MAX_BROWSE));
			setSel(0);
		} else {
			setInput("");
			setCaret(0);
			setBrowse(null);
			setSel(-1);
		}
		requestAnimationFrame(() => inputRef.current?.focus());
	}, [returnHits, returnQuery]);

	const exec = useCallback(
		(raw: string, echo = raw) => {
			const command = raw.trim().toLowerCase();
			const result = runCommand(raw, { cwd, history: historyRef.current, roms, systems });
			if (raw.trim()) historyRef.current = [...historyRef.current, raw.trim()];
			if (result.clear) setBlocks([]);
			else push({ cwd, input: echo, lines: result.lines });
			if (result.cwd) setCwd(result.cwd);
			setInput("");
			setCaret(0);
			setBrowse(null);
			setSel(-1);
			setHistIndex(-1);
			if (command === "cd" || command.startsWith("cd ")) restoreSearch();
		},
		[cwd, push, restoreSearch, roms, systems],
	);

	const openRom = useCallback((rom: RomEntry, echo: string) => {
		exec(`cat ${pathForRom(rom)}`, echo);
		const request = document.createElement("iframe");
		request.src = rom.url;
		request.title = `download ${fileName(rom)}`;
		request.setAttribute("aria-hidden", "true");
		request.style.display = "none";
		document.body.appendChild(request);
		window.setTimeout(() => request.remove(), 30000);
	}, [exec]);

	const syncCaret = () => {
		const element = inputRef.current;
		if (element) setCaret(element.selectionStart ?? element.value.length);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		const key = event.key;
		if (event.ctrlKey && (key === "l" || key === "L")) {
			event.preventDefault();
			setBlocks([]);
			return;
		}
		if (event.ctrlKey && (key === "c" || key === "C")) {
			event.preventDefault();
			push({ cwd, input: `${input}^C`, lines: [] });
			setInput("");
			setSel(-1);
			return;
		}
		if (event.ctrlKey && (key === "u" || key === "U")) {
			event.preventDefault();
			setInput("");
			setBrowse(null);
			setSel(-1);
			return;
		}
		if (browse) {
			if (key === "ArrowDown") {
				event.preventDefault();
				keyboardMove.current = true;
				setSel((value) => (value + 1 >= browse.length ? 0 : value + 1));
				return;
			}
			if (key === "ArrowUp") {
				event.preventDefault();
				keyboardMove.current = true;
				setSel((value) => (value - 1 < 0 ? browse.length - 1 : value - 1));
				return;
			}
			if (key === "Enter" && browse[sel]) {
				event.preventDefault();
				openRom(browse[sel].rom, input);
				return;
			}
			if (key === "Escape") {
				event.preventDefault();
				restoreSearch();
				return;
			}
		}
		if (key === "ArrowDown") {
			event.preventDefault();
			keyboardMove.current = true;
			if (shown.length) setSel((value) => (value + 1 >= shown.length ? -1 : value + 1));
			else if (histIndex >= 0) {
				const next = histIndex - 1;
				setHistIndex(next);
				setInput(next < 0 ? draft.current : historyRef.current[historyRef.current.length - 1 - next] ?? "");
			}
			return;
		}
		if (key === "ArrowUp") {
			event.preventDefault();
			keyboardMove.current = true;
			if (shown.length) setSel((value) => (value - 1 < -1 ? shown.length - 1 : value - 1));
			else {
				const next = Math.min(histIndex + 1, historyRef.current.length - 1);
				if (next < 0) return;
				if (histIndex === -1) draft.current = input;
				setHistIndex(next);
				setInput(historyRef.current[historyRef.current.length - 1 - next] ?? "");
			}
			return;
		}
		if (key === "Tab") {
			event.preventDefault();
			const parts = input.split(/\s+/);
			const head = parts[0]?.toLowerCase() ?? "";
			if (parts.length === 1 && !TAKES_PATH.has(head)) {
				if (sel >= 0 && shown[sel]) {
					const next = `cat ${pathForRom(shown[sel].rom)}`;
					setInput(next);
					setCaret(next.length);
					return;
				}
				const matches = COMMANDS.filter((command) => command.startsWith(head));
				if (matches.length === 1) {
					setInput(`${matches[0]} `);
					setCaret(matches[0].length + 1);
				} else if (matches.length > 1) {
					push({ cwd, input, lines: [line(s(matches.join("  "), "dim"))] });
				}
				return;
			}
			const fragment = parts[parts.length - 1] ?? "";
			const options = completions(roms, systems, cwd, fragment);
			if (options.length === 1) {
				parts[parts.length - 1] = options[0];
				const next = parts.join(" ");
				setInput(next);
				setCaret(next.length);
			} else if (options.length > 1) {
				const prefix = commonPrefix(options);
				if (prefix.length > fragment.length) {
					parts[parts.length - 1] = prefix;
					setInput(parts.join(" "));
				}
				push({ cwd, input, lines: [line(s(options.slice(0, 40).join("  "), "dim"))] });
			}
			return;
		}
		if (key === "Enter") {
			event.preventDefault();
			if (sel >= 0 && shown[sel]) openRom(shown[sel].rom, input);
			else if (liveHits.length) {
				setBrowse(liveHits.slice(0, MAX_BROWSE));
				setSel(0);
			} else exec(input);
			return;
		}
		if (key === "Escape") {
			event.preventDefault();
			restoreSearch();
		}
	};

	const resultSegments = (hit: RomHit, index: number): Line => {
		const rom = hit.rom;
		return [
			s(` ${pad(index + 1 + ".", 4)}`, "dim"),
			...highlight(fit(rom.title, 44), hit.hl, index === sel ? "fg" : "bright"),
			s(` ${rom.date?.slice(-4) ?? "----"} `, "dim"),
			s(` /${pathForRom(rom).slice(1)}`, "amber"),
		];
	};

	const prompt = (at: string) => [s("roms tn", "amber"), s(":", "dim"), s(at, "bright"), s("$ ", "dim")];
	const before = input.slice(0, caret);
	const atCaret = input.slice(caret, caret + 1);
	const after = input.slice(caret + 1);
	const statusText = !roms.length ? `STATUS: ${status}` : browse ? `${browse.length} records - browse` : liveQuery ? `${liveHits.length} hit${liveHits.length === 1 ? "" : "s"}` : `DATA: ${dataSource}`;

	return (
		<div className="min-h-screen px-3 pb-16 pt-3 sm:px-5" onMouseUp={focus}>
			<div aria-live="polite">{lines.slice(0, booted).map((value, index) => <Row key={index} segs={value} />)}</div>
			{blocks.map((block) => (
				<div key={block.id}>
					{block.input !== undefined && <Row segs={[...prompt(block.cwd ?? "/"), s(block.input, "fg")]} />}
					{block.lines.map((value, index) => <Row key={index} segs={value} />)}
					{block.lines.length > 0 && <Row segs={blank} />}
				</div>
			))}
			{booted >= lines.length && (
				<>
					<div className="pre">
						{prompt(cwd).map((segment, index) => <span className={segment.c ? TONE[segment.c] : TONE.fg} key={index}>{segment.t}</span>)}
						<span className="text-white">{before}</span>
						<span className={`${focused ? "caret" : "caret-idle"} ${focused ? "bg-fg text-black" : "bg-transparent text-white outline outline-1 outline-dark"}`}>{atCaret || " "}</span>
						<span className="text-white">{after}</span>
					</div>
					{browse ? (
						<div className="mt-1">
							<Row segs={line(s(` browse: ${browse.length} record${browse.length === 1 ? "" : "s"}`, "amber"), s(` - enter or click to open - ↑↓ to move`, "dim"))} />
							{browse.map((hit: RomHit, index) => (
								<button className="block w-full cursor-pointer text-left" key={hit.rom.id} onClick={() => openRom(hit.rom, input)} onMouseEnter={() => setSel(index)} ref={(element) => { browseItemRefs.current[index] = element; }} type="button">
									<Row inverse={index === sel} segs={resultSegments(hit, index)} />
								</button>
							))}
							{liveHits.length > browse.length && <Row segs={line(s(` showing first ${browse.length} of ${liveHits.length} matches - refine the query to narrow it`, "dim"))} />}
						</div>
					) : live ? (
						<div className="mt-1">
							{shown.map((hit: RomHit, index) => <Row inverse={index === sel} key={hit.rom.id} segs={resultSegments(hit, index)} />)}
							{liveHits.length === 0 && <Row segs={line(s(` no match for "${liveQuery}"`, "err"))} />}
							{liveHits.length > 0 && <Row segs={line(s(` ${liveHits.length} match${liveHits.length === 1 ? "" : "es"}`, "dim"), s(liveHits.length > shown.length ? ` (${shown.length} shown, enter to list all)` : "", "dim"), s(`  ${live.ms.toFixed(2)}ms`, "dim"))} />}
						</div>
					) : null}
				</>
			)}
			<div className="h-4" ref={endRef} />
			<input
				aria-label="terminal input"
				autoCapitalize="off"
				autoComplete="off"
				autoCorrect="off"
				className="fixed -left-[9999px] top-0 h-px w-px opacity-0"
				onBlur={() => setFocused(false)}
				onChange={(event) => { setInput(event.target.value); setBrowse(null); setSel(-1); setHistIndex(-1); requestAnimationFrame(syncCaret); }}
				onClick={syncCaret}
				onFocus={() => setFocused(true)}
				onKeyDown={onKeyDown}
				onKeyUp={syncCaret}
				ref={inputRef}
				spellCheck={false}
				value={input}
			/>
			<div className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-[#202020] text-neutral-500">
				<div className="pre flex justify-between px-2 py-0.5 text-[11px] sm:text-[12px]">
					<span className="truncate text-neutral-500">roms tn:{cwd} - {statusText} - source: http://92.35.124.13</span>
					<span className="hidden shrink-0 pl-4 text-neutral-600 sm:inline">tab complete - ↑↓ select - enter open - ctrl-l clear - help</span>
					<span className="shrink-0 pl-2 text-neutral-600 sm:hidden">help</span>
				</div>
			</div>
		</div>
	);
}
