/**
 * Download real box art from ScreenScraper and bake it into public/.
 *
 * Same three-phase flow Panoply uses (src/lib/screenscraper.js there):
 *   1. jeuRecherche.php  -> game id
 *   2. jeuInfos.php      -> medias
 *   3. pick a media by type and region, then download it
 *
 * Requests are serial with a gap between them and retries only on 429/5xx,
 * because ScreenScraper throttles aggressive clients. A match is accepted only
 * when both the console and the title agree, because a same-titled game from
 * another system comes back with convincingly wrong box art.
 *
 * Credentials come from SCREENSCRAPER_DEV_ID / SCREENSCRAPER_DEV_PASSWORD /
 * SCREENSCRAPER_SOFT_NAME (the .env.local is read too).
 *
 * Two sets:
 *   catalog (default)  the 16 archive covers  -> public/images/covers/<id>.png
 *   labels             the cartridge stickers  -> public/images/labels/<slug>.png
 *
 * Covers come from the box front. Cartridge labels come from "support-texture",
 * the sticker artwork printed on the plastic (that is the asset Panoply uses on
 * its 3D cartridges), falling back to the flat support and only then the box.
 *
 * Only one file is ever written per game and it is always a finished PNG: art
 * is staged next to its target and renamed into place. Label art is laid into
 * the exact window of the texture each model's UVs sample (labelFace in
 * src/data/lineup.json, measured off the GLBs) so nothing is stretched and
 * nothing is cut off on the cartridge.
 *
 *   node scripts/fetch-covers.mjs                 # fetch whatever is missing
 *   node scripts/fetch-covers.mjs --force         # refetch everything
 *   node scripts/fetch-covers.mjs --set=labels    # the lineup labels instead
 *   node scripts/fetch-covers.mjs --only=zelda-ocarina
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogFile = path.join(root, "src/lib/catalog.ts");
const lineupFile = path.join(root, "src/data/lineup.json");
const force = process.argv.includes("--force");
const only = process.argv.find((argument) => argument.startsWith("--only="))?.split("=")[1];
const set = process.argv.find((argument) => argument.startsWith("--set="))?.split("=")[1] ?? "catalog";

const API = "https://www.screenscraper.fr/api2";
const GAP_MS = 500;
const TIMEOUT_MS = 25000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
// Front cover art first: that is what the cards and the detail view want.
const COVER_TYPES = ["box-2D", "box-texture", "box-2D-inverted", "box-texture-inverted", "wheel"];
// The cartridge label is a different asset: Panoply fetches "support-texture",
// the sticker artwork that is printed on the plastic, and it is already cropped
// to the shape of the label. Fall back to the flat support then the box only if
// a game has no sticker.
const LABEL_TYPES = ["support-texture", "support-2D", "box-2D", "box-texture"];
const REGION_ORDER = ["wor", "us", "eu", "ss", "jp"];
const SYSTEM_ALIASES = {
  n64: ["nintendo 64", "n64"],
  gba: ["game boy advance", "gba"],
  nds: ["nintendo ds", "nintendo dsi", "nds", "ds"],
  switch: ["nintendo switch", "switch"],
  gb: ["game boy", "gb"],
  snes: ["super nintendo", "super nes", "snes"],
  ps1: ["playstation", "ps1"],
  genesis: ["mega drive", "sega genesis", "genesis"],
};
// Long edge of the baked image. Covers are shown up to ~420px wide and labels
// up to ~370px, both at up to 2x, so 640 keeps them crisp.
const OUTPUT = 640;

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
    if (id && title && platform && cover) games.push({ id, title, platform, cover, face: null });
  }
  return games;
}

function labelGames() {
  const data = JSON.parse(fs.readFileSync(lineupFile, "utf8"));
  const games = [];
  for (const [platform, titles] of Object.entries(data.titles ?? {})) {
    for (const entry of titles) {
      games.push({
        id: entry.cover.replace(/^.*\//, "").replace(/\.png$/, ""),
        title: entry.title,
        platform,
        cover: entry.cover,
        face: data.labelFace?.[platform] ?? null,
      });
    }
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

async function pickMedia(gameId, title, expectedSystemId, typeOrder = COVER_TYPES) {
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
  for (const type of typeOrder) {
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

/**
 * Bake the finished PNG. Covers are only scaled down.
 *
 * Label art is placed inside the sub rectangle of the texture the model's own
 * UVs sample (the "window" in src/data/lineup.json, measured off each GLB), so
 * the sticker lands on the plastic with nothing stretched and nothing cut off.
 * The window's shape is the label face's shape and the rest of the image is
 * never on screen, so those margins just repeat the sticker's edge pixels. A
 * fallback box art is a different shape from a sticker, so it is cropped to the
 * window's shape first (a little above centre, where the logo sits) rather than
 * squashed into it.
 */
async function bake(buffer, target, face = null) {
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  const rotated = (meta.orientation ?? 1) >= 5;
  const sourceWidth = rotated ? meta.height : meta.width;
  const sourceHeight = rotated ? meta.width : meta.height;
  if (!sourceWidth || !sourceHeight) throw new Error("unreadable image");
  const staging = `${target}.tmp`;
  let pipeline = sharp(buffer, { failOn: "none" }).rotate();
  let width;
  let height;

  if (!face) {
    const scale = Math.min(1, OUTPUT / Math.max(sourceWidth, sourceHeight));
    width = Math.max(1, Math.round(sourceWidth * scale));
    height = Math.max(1, Math.round(sourceHeight * scale));
    await pipeline
      .resize({ width, height, fit: "fill" })
      .png({ compressionLevel: 9 })
      .toFile(staging);
  } else {
    const du = face.u[1] - face.u[0];
    const dv = face.v[1] - face.v[0];
    // Never invent resolution the sticker does not have.
    const windowLong = Math.max(64, Math.min(OUTPUT, Math.max(sourceWidth, sourceHeight)));
    const windowWidth = Math.max(1, Math.round(face.aspect >= 1 ? windowLong : windowLong * face.aspect));
    const windowHeight = Math.max(1, Math.round(face.aspect >= 1 ? windowLong / face.aspect : windowLong));
    width = Math.max(windowWidth, Math.round(windowWidth / du));
    height = Math.max(windowHeight, Math.round(windowHeight / dv));
    const left = Math.min(width - windowWidth, Math.round(face.u[0] * width));
    // v runs bottom up in texture space and top down in image space.
    const top = Math.min(height - windowHeight, Math.round((1 - face.v[1]) * height));
    const sourceAspect = sourceWidth / sourceHeight;
    if (Math.abs(sourceAspect - face.aspect) / face.aspect > 0.15) {
      let cropWidth = sourceWidth;
      let cropHeight = Math.round(sourceWidth / face.aspect);
      if (cropHeight > sourceHeight) {
        cropHeight = sourceHeight;
        cropWidth = Math.round(sourceHeight * face.aspect);
      }
      pipeline = pipeline.extract({
        left: Math.round((sourceWidth - cropWidth) / 2),
        top: Math.round((sourceHeight - cropHeight) * 0.32),
        width: cropWidth,
        height: cropHeight,
      });
    }
    await pipeline
      .resize({ width: windowWidth, height: windowHeight, fit: "fill" })
      .extend({
        left,
        top,
        right: width - windowWidth - left,
        bottom: height - windowHeight - top,
        extendWith: "copy",
      })
      .png({ compressionLevel: 9 })
      .toFile(staging);
  }
  fs.renameSync(staging, target);
  return { width, height, bytes: fs.statSync(target).size };
}

async function main() {
  loadEnv();
  if (!DEV_ID || !DEV_PASSWORD) {
    console.error("Set SCREENSCRAPER_DEV_ID and SCREENSCRAPER_DEV_PASSWORD (in .env.local or the environment).");
    process.exit(1);
  }
  const all = set === "labels" ? labelGames() : catalogGames();
  const types = set === "labels" ? LABEL_TYPES : COVER_TYPES;
  const games = all.filter((game) => !only || game.id === only || game.title === only);
  console.log(`${games.length} ${set} art files, writing to public/images/${set === "labels" ? "labels" : "covers"}\n`);
  const results = [];
  for (const game of games) {
    const target = path.join(root, "public", game.cover.replace(/^\//, ""));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!force && fs.existsSync(target) && fs.statSync(target).size > 20000) {
      console.log(`skip   ${game.id.padEnd(24)} already real (${Math.round(fs.statSync(target).size / 1024)}kb)`);
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
          media = await pickMedia(gameId, game.title, systemId, types);
          matched = media.matched;
          break;
        } catch (error) {
          lastError = error.message;
        }
      }
      if (!media) throw new Error(lastError || "no usable media");
      const { buffer, format } = await download(media.url);
      const baked = await bake(buffer, target, game.face);
      console.log(
        `got    ${game.id.padEnd(24)} ${media.type.padEnd(12)} ${format} ${Math.round(buffer.length / 1024)}kb -> ${baked.width}x${baked.height} ${Math.round(baked.bytes / 1024)}kb (of ${tried}) "${matched ?? ""}"`,
      );
      results.push({ id: game.id, ok: true, format, ...baked });
    } catch (error) {
      console.log(`FAIL   ${game.id.padEnd(24)} ${game.title} -> ${error.message}`);
      results.push({ id: game.id, ok: false, error: error.message });
    }
  }
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} written`);
  if (failed.length) {
    console.log("failed:", failed.map((result) => result.id).join(", "));
    process.exitCode = 1;
  }
}

await main();
