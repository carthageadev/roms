/**
 * Replace the placeholder cover art with real box art from ScreenScraper.
 *
 * Same three-phase flow Panoply uses (src/lib/screenscraper.js there):
 *   1. jeuRecherche.php  -> game id
 *   2. jeuInfos.php      -> medias
 *   3. pick a media by type and region, then download it
 *
 * Requests are serial with a gap between them and retries only on 429/5xx,
 * because ScreenScraper throttles aggressive clients.
 *
 * Credentials come from SCREENSCRAPER_DEV_ID / SCREENSCRAPER_DEV_PASSWORD /
 * SCREENSCRAPER_SOFT_NAME (the .env.local is read too). Writes to
 * public/images/covers/<catalog id>.png, the paths the catalog already uses.
 *
 *   node scripts/fetch-covers.mjs            # only fetch what is missing
 *   node scripts/fetch-covers.mjs --force    # refetch everything
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogFile = path.join(root, "src/lib/catalog.ts");
const coverDir = path.join(root, "public/images/covers");
const force = process.argv.includes("--force");
const only = process.argv.find((argument) => argument.startsWith("--only="))?.split("=")[1];

const API = "https://www.screenscraper.fr/api2";
const GAP_MS = 500;
const TIMEOUT_MS = 25000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
// Front cover art first: that is what the cards and detail view want.
const TYPE_ORDER = ["box-2D", "box-texture", "box-2D-inverted", "box-texture-inverted", "support-texture", "wheel"];
const REGION_ORDER = ["wor", "us", "eu", "ss", "jp"];
const SYSTEM_ALIASES = {
  n64: ["nintendo 64", "n64"],
  gba: ["game boy advance", "gba"],
  gb: ["game boy", "gb"],
  snes: ["super nintendo", "super nes", "snes"],
  ps1: ["playstation", "ps1"],
  genesis: ["mega drive", "sega genesis", "genesis"],
};

function loadEnv() {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

function catalogGames() {
  const source = fs.readFileSync(catalogFile, "utf8");
  const games = [];
  for (const line of source.split(/\r?\n/)) {
    if (!line.includes("cover:")) continue;
    const id = line.match(/\bid:\s*"([^"]+)"/)?.[1];
    const title = line.match(/\btitle:\s*"([^"]+)"/)?.[1];
    const platform = line.match(/\bplatform:\s*"([^"]+)"/)?.[1];
    const cover = line.match(/\bcover:\s*"([^"]+)"/)?.[1];
    if (id && title && platform && cover) games.push({ id, title, platform, cover });
  }
  return games;
}

const DEV_ID = (process.env.SCREENSCRAPER_DEV_ID ?? "").trim();
const DEV_PASSWORD = (process.env.SCREENSCRAPER_DEV_PASSWORD ?? "").trim();
const SOFT_NAME = (process.env.SCREENSCRAPER_SOFT_NAME ?? "roms-tn").trim() || "roms-tn";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let gate = 0;

async function request(url, { binary = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    const gap = gate - Date.now();
    if (gap > 0) await wait(gap);
    gate = Date.now() + GAP_MS;
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": `${SOFT_NAME}/1.0 (cover fetcher)` } });
    } catch (error) {
      if (attempt >= 3) throw new Error(`network: ${error.message}`);
      await wait(800 * 2 ** attempt);
      continue;
    }
    if (!RETRYABLE.has(response.status) || attempt >= 3) {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return binary ? Buffer.from(await response.arrayBuffer()) : JSON.parse(await response.text());
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt);
  }
}

const params = (extra) => new URLSearchParams({ devid: DEV_ID, devpassword: DEV_PASSWORD, softname: SOFT_NAME, output: "json", ...extra }).toString();

let systemIds = null;

async function loadSystemIds() {
  if (systemIds) return systemIds;
  const data = await request(`${API}/systemesListe.php?${params({})}`);
  const raw = data?.response?.systemes ?? data?.response?.systeme;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  systemIds = new Map();
  for (const entry of list) {
    const id = entry?.id ? String(entry.id) : null;
    if (!id) continue;
    // Names live under `noms`, and there are several of them per system.
    const noms = entry.noms ?? {};
    const names = [noms.nom_eu, noms.nom_us, noms.nom_launchbox, noms.noms_commun]
      .filter(Boolean)
      .flatMap((name) => String(name).split(","))
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
    for (const name of names) if (!systemIds.has(name)) systemIds.set(name, id);
  }
  return systemIds;
}

async function systemIdFor(platform) {
  const ids = await loadSystemIds();
  for (const alias of SYSTEM_ALIASES[platform] ?? [platform]) {
    const hit = ids.get(alias);
    if (hit) return hit;
  }
  return null;
}

// ScreenScraper does not match curly apostrophes, it often finds nothing for a
// full title carrying a subtitle, and an accented search can land on the wrong
// entry. So gather candidate game ids from a few spellings and keep the first
// one that actually has usable art.
function searchTerms(title) {
  const straight = title.replace(/[\u2018\u2019]/g, "'");
  const plain = straight.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const head = straight.split(":")[0].trim();
  const tail = straight.split(":").slice(1).join(":").trim();
  const noArticle = head.replace(/^(the|a|an)\s+/i, "").trim();
  return [...new Set([plain, straight, head, noArticle, tail].filter((term) => term && term.length > 2))];
}

async function searchCandidates(title, systemId) {
  const ids = [];
  for (const term of searchTerms(title)) {
    const query = systemId ? { systemeid: systemId, recherche: term } : { recherche: term };
    const data = await request(`${API}/jeuRecherche.php?${params(query)}`);
    const raw = data?.response?.jeux;
    const list = Array.isArray(raw) ? raw : raw?.jeu ? [].concat(raw.jeu) : [];
    for (const entry of list) {
      const id = entry?.id ? String(entry.id) : null;
      if (id && id !== "0" && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

const ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };

const normalise = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|of|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // "Streets of Rage II" is the same game as "Streets of Rage 2".
    .split(" ")
    .map((word) => ROMAN[word] ?? word)
    .join(" ");

/**
 * ScreenScraper can return a different game on the right console ("Super Mario
 * World" for Yoshi's Island). Accept the match only when every distinctive
 * word of the title we asked for is present in the one we got back.
 */
function titleMatches(expected, actual) {
  const wanted = normalise(expected).split(" ").filter(Boolean);
  const got = new Set(normalise(actual).split(" ").filter(Boolean));
  if (!wanted.length) return true;
  return wanted.every((word) => got.has(word));
}

async function pickMedia(gameId, title, expectedSystemId) {
  const data = await request(`${API}/jeuInfos.php?${params({ gameid: gameId })}`);
  const jeu = data?.response?.jeu ?? {};
  // The screen-scraper record keeps its name in a region list and its console
  // under `systeme`, not in flat fields.
  const names = Array.isArray(jeu.noms) ? jeu.noms : [];
  const actualName =
    ["wor", "eu", "us", "ss", "jp"].map((region) => names.find((entry) => entry?.region === region && entry.text)?.text).find(Boolean) ??
    names[0]?.text ??
    "";
  const found = jeu.systeme?.id ? String(jeu.systeme.id) : jeu.systemeid ? String(jeu.systemeid) : null;
  if (expectedSystemId && found && found !== expectedSystemId) {
    throw new Error(`wrong system (wanted ${expectedSystemId}, got ${found})`);
  }
  if (!titleMatches(title, actualName)) {
    throw new Error(`wrong game ("${actualName || "?"}")`);
  }
  const medias = jeu.medias ?? [];
  for (const type of TYPE_ORDER) {
    const candidates = medias.filter((media) => media?.type === type && media?.url);
    if (!candidates.length) continue;
    for (const region of REGION_ORDER) {
      const hit = candidates.find((media) => media.region === region);
      if (hit) return { url: hit.url, type, matched: actualName };
    }
    return { url: candidates[0].url, type, matched: actualName };
  }
  const any = medias.find((media) => media?.url && /-(2D|texture|poster|flyer|screenshot)/i.test(media.type ?? ""));
  if (any) return { url: any.url, type: any.type, matched: actualName };
  const loose = medias.find((media) => media?.url && /image|picture/i.test(media.type ?? ""));
  if (loose) return { url: loose.url, type: loose.type, matched: actualName };
  throw new Error(`no usable media for "${title}" (had ${medias.length})`);
}

async function download(mediaUrl) {
  const url = new URL(mediaUrl);
  if (!url.searchParams.has("devid")) url.searchParams.set("devid", DEV_ID);
  if (!url.searchParams.has("devpassword")) url.searchParams.set("devpassword", DEV_PASSWORD);
  if (!url.searchParams.has("softname")) url.searchParams.set("softname", SOFT_NAME);
  const buffer = await request(url.toString(), { binary: true });
  const signature = buffer.subarray(0, 8);
  const isJpeg = signature[0] === 0xff && signature[1] === 0xd8;
  const isPng = signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isJpeg && !isPng) throw new Error(`unexpected image bytes (${buffer.subarray(0, 4).toString("hex")})`);
  return { buffer, format: isPng ? "png" : "jpeg" };
}

async function main() {
  loadEnv();
  if (!DEV_ID || !DEV_PASSWORD) {
    console.error("Set SCREENSCRAPER_DEV_ID and SCREENSCRAPER_DEV_PASSWORD (in .env.local or the environment).");
    process.exit(1);
  }
  fs.mkdirSync(coverDir, { recursive: true });
  const games = catalogGames().filter((game) => !only || game.id === only);
  console.log(`${games.length} catalog games, writing to public/images/covers\n`);
  const results = [];
  for (const game of games) {
    const target = path.join(root, "public", game.cover.replace(/^\//, ""));
    if (!force && fs.existsSync(target) && fs.statSync(target).size > 20000) {
      console.log(`skip   ${game.id.padEnd(18)} already real (${Math.round(fs.statSync(target).size / 1024)}kb)`);
      results.push({ id: game.id, ok: true, skipped: true });
      continue;
    }
    try {
      const systemId = await systemIdFor(game.platform);
      if (!systemId) throw new Error(`no ScreenScraper system for "${game.platform}"`);
      const candidates = await searchCandidates(game.title, systemId);
      if (!candidates.length) throw new Error("no search match");
      let media = null;
      let matched = null;
      let tried = 0;
      let lastError = "";
      for (const gameId of candidates.slice(0, 8)) {
        tried += 1;
        try {
          media = await pickMedia(gameId, game.title, systemId);
          matched = media.matched;
          break;
        } catch (error) {
          lastError = error.message;
        }
      }
      if (!media) throw new Error(lastError || "no usable media");
      const { buffer, format } = await download(media.url);
      const staging = `${target}.raw`;
      fs.writeFileSync(staging, buffer);
      console.log(`got    ${game.id.padEnd(18)} ${media.type.padEnd(12)} ${format} ${Math.round(buffer.length / 1024)}kb (of ${tried}) "${matched ?? ""}"`);
      results.push({ id: game.id, ok: true, format, bytes: buffer.length, staging, target });
    } catch (error) {
      console.log(`FAIL   ${game.id.padEnd(18)} ${game.title} -> ${error.message}`);
      results.push({ id: game.id, ok: false, error: error.message });
    }
  }
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} fetched`);
  if (failed.length) {
    console.log("failed:", failed.map((result) => result.id).join(", "));
    process.exitCode = 1;
  }
}

await main();