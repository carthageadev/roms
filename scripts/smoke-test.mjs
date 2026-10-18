import { chromium, expect as baseExpect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

// This suite renders WebGL in software, so every wait gets room to breathe.
const expect = baseExpect.configure({ timeout: 30000 });
const base = process.env.PREVIEW_URL ?? "http://localhost:3000";
fs.mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  // The home page is WebGL, so the browser needs a software GL to render it.
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const library = () => page.evaluate(async () => (await fetch("/api/library")).json());
const action = (input) => page.evaluate(async (body) => {
  const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}, input);
const fits = (target) => target.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1);
const stageIndex = () => page.locator(".lineup-stage").getAttribute("data-index");

try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const stage = page.locator(".lineup-stage");
  await expect(stage).toBeVisible({ timeout: 120000 });
  await expect(page.locator("h1")).toHaveText(/Good games/);
  assert.equal(await fits(page), true, "the home page must fit one screen");
  assert.equal(await page.locator(".mobile-menu-button").isVisible(), false);

  // Cartridges arrive one by one; `data-loaded` counts them.
  await expect.poll(async () => Number((await stage.getAttribute("data-loaded")) ?? 0), { timeout: 180000 }).toBeGreaterThan(0);
  const title = page.locator(".lineup-caption h2");
  await expect(title).not.toBeEmpty();
  await expect(page.locator(".lineup-caption p")).not.toBeEmpty();
  await page.screenshot({ path: "artifacts/home-desktop.png" });
  console.log("PASS: dark home fits one screen and the cartridge line renders");

  // The line steps along on its own.
  const idleStart = await stageIndex();
  await expect.poll(stageIndex, { timeout: 30000 }).not.toBe(idleStart);

  // The arrows step backwards and forwards. Backwards is the telling one: the
  // idle motion only ever moves the other way.
  const before = await stageIndex();
  await page.getByRole("button", { name: "Previous cartridge", exact: true }).click();
  const previous = String((Number(before) + 11) % 12);
  await expect.poll(stageIndex, { timeout: 30000 }).toBe(previous);
  await page.getByRole("button", { name: "Next cartridge", exact: true }).click();
  await expect.poll(stageIndex, { timeout: 30000 }).toBe(before);
  console.log("PASS: the line drifts on its own and the arrows step it");

  await page.locator(".main-nav button").filter({ hasText: "Lists" }).click();
  await expect(page.locator(".page-heading h1")).toHaveText("Make a list.");
  await page.getByRole("button", { name: "Create your first list", exact: true }).click();
  await page.getByLabel(/Collection name/).fill("Sunday favorites");
  await page.getByLabel(/A few words/).fill("A small archive for slow afternoons.");
  await page.locator(".picker-game").filter({ hasText: "Pokémon Emerald" }).click();
  await page.getByRole("button", { name: "Choose #e7e6ed collection color", exact: true }).click();
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await expect(page.locator(".collection-card").filter({ hasText: "Sunday favorites" })).toBeVisible();
  let data = await library();
  assert.equal(data.collections.length, 1);
  assert.deepEqual(data.collections[0].gameIds, ["pokemon-emerald"]);
  assert.equal(data.collections[0].color, "#e7e6ed");
  console.log("PASS: a list can be created with a name, words, games and a colour");

  await page.locator(".collection-card").filter({ hasText: "Sunday favorites" }).click();
  await page.getByRole("button", { name: "Edit collection", exact: true }).click();
  await page.getByLabel(/Collection name/).fill("Slow Sunday");
  await page.locator(".picker-game").filter({ hasText: "Chrono Trigger" }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".collection-card").filter({ hasText: "Slow Sunday" })).toBeVisible();
  data = await library();
  assert.equal(data.collections[0].name, "Slow Sunday");
  assert.equal(data.collections[0].gameIds.length, 2);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".main-nav button").filter({ hasText: "Lists" }).click();
  await expect(page.locator(".collection-card").filter({ hasText: "Slow Sunday" })).toBeVisible();
  console.log("PASS: lists can be edited and survive a reload");

  await page.locator(".collection-card").filter({ hasText: "Slow Sunday" }).click();
  await page.locator(".collection-game-grid .game-title").first().click();
  await expect(page.locator(".game-detail-modal h2")).toContainText("Emerald");
  await page.getByRole("button", { name: "Save to your library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved to your library", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  assert.deepEqual((await library()).savedGameIds, ["pokemon-emerald"]);
  console.log("PASS: a game opens from its list and can be saved");

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await mobile.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.goto(base, { waitUntil: "domcontentloaded" });
  await expect(phone.locator(".lineup-stage")).toBeVisible({ timeout: 120000 });
  assert.equal(await fits(phone), true, "the home page must fit one phone screen");
  assert.equal(await phone.locator(".main-nav .nav-link").first().isVisible(), true, "the nav stays on small screens");
  await phone.screenshot({ path: "artifacts/home-mobile.png" });
  await phone.locator(".main-nav button").filter({ hasText: "Lists" }).click();
  await expect(phone.locator(".page-heading h1")).toHaveText("Make a list.");
  await phone.getByRole("button", { name: "New list", exact: true }).click();
  await expect(phone.locator(".editor-modal")).toBeVisible();
  await phone.keyboard.press("Escape");
  await phone.setViewportSize({ width: 320, height: 740 });
  await phone.goto(base, { waitUntil: "domcontentloaded" });
  assert.equal(await fits(phone), true, "the narrow home must fit too");
  await mobile.close();
  console.log("PASS: phone and narrow-phone layouts hold together");

  const allGames = await context.request.get(base + "/api/games").then((response) => response.json());
  assert.equal(allGames.total, 16);
  for (const game of allGames.games) {
    const response = await context.request.get(base + game.cover);
    assert.equal(response.status(), 200, game.id);
    assert.equal((await response.body()).subarray(0, 4).toString("hex"), "89504e47", game.id);
  }
  assert.equal((await action({ action: "toggle-save", gameId: "unknown" })).status, 404);
  assert.equal((await action({ action: "create-collection", name: "", gameIds: [] })).status, 400);
  assert.equal((await action({ action: "update-collection", collectionId: "nope", name: "x", gameIds: [] })).status, 404);
  console.log("PASS: every cover resolves and bad requests are rejected");

  const isolated = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const stranger = await isolated.newPage();
  await stranger.goto(base, { waitUntil: "domcontentloaded" });
  const otherLibrary = await stranger.evaluate(async (id) => {
    const before = await (await fetch("/api/library")).json();
    const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-collection", collectionId: id, name: "Not yours", gameIds: [] }) });
    return { savedGameIds: before.savedGameIds, collections: before.collections, status: response.status };
  }, data.collections[0].id);
  assert.deepEqual(otherLibrary.savedGameIds, []);
  assert.deepEqual(otherLibrary.collections, []);
  assert.equal(otherLibrary.status, 404, "another browser must not touch this list");
  await isolated.close();
  console.log("PASS: lists stay private per browser");

  await page.locator(".main-nav button").filter({ hasText: "Lists" }).click();
  await page.locator(".collection-card").filter({ hasText: "Slow Sunday" }).click();
  await page.getByRole("button", { name: "Edit collection", exact: true }).click();
  await page.getByRole("button", { name: "Delete collection", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(page.locator(".editor-modal")).toHaveCount(0);
  assert.equal((await library()).collections.some((collection) => collection.name === "Slow Sunday"), false);
  data = await library();
  for (const collection of data.collections) await action({ action: "delete-collection", collectionId: collection.id });
  for (const gameId of data.savedGameIds) await action({ action: "toggle-save", gameId });
  const cleaned = await library();
  assert.equal(cleaned.collections.length, 0);
  assert.equal(cleaned.savedGameIds.length, 0);
  assert.deepEqual(errors, []);
  console.log("PASS: lists delete cleanly, no runtime errors anywhere");
  console.log("ALL FULLSTACK AND BROWSER CHECKS PASSED");
} catch (error) {
  console.error("CHECK FAILED:", error);
  console.error("Runtime errors:", errors);
  console.error("Open dialogs:", await page.locator(".modal-panel h2").allTextContents().catch(() => []));
  console.error("Submit labels:", await page.locator(".editor-modal button[type=submit]").allTextContents().catch(() => []));
  console.error("Body:", (await page.locator("body").ariaSnapshot().catch(() => "")).slice(0, 1200));
  await page.screenshot({ path: "artifacts/functional-failure.png" });
  process.exitCode = 1;
} finally {
  await browser.close();
}
