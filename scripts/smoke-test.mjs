import { chromium, expect as baseExpect } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const expect = baseExpect.configure({ timeout: 30000 })
const base = process.env.PREVIEW_URL ?? 'http://localhost:3000'
fs.mkdirSync('artifacts', { recursive: true })
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const errors = []

// The showcase picks a system after mount. Pinning Math.random keeps each run
// deterministic: it draws the platform, then one of that system's games.
const PLATFORMS = {
  gba: {
    random: 0.1,
    system: 'Game Boy Advance',
    game: 'Metroid Fusion',
    label: '/images/labels/metroid-fusion.png',
  },
  nds: {
    random: 0.4,
    system: 'Nintendo DS',
    game: 'New Super Mario Bros.',
    label: '/images/labels/new-super-mario-bros.png',
  },
  snes: {
    random: 0.6,
    system: 'Super Nintendo',
    game: 'Chrono Trigger',
    label: '/images/labels/chrono-trigger.png',
  },
  nes: {
    random: 0.9,
    system: 'Nintendo Entertainment System',
    game: 'Mega Man 2',
    label: '/images/labels/mega-man-2.png',
  },
}

async function makeContext({ viewport, platform, reducedMotion, mobile = false, permission }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion,
    isMobile: mobile,
    hasTouch: mobile,
  })
  await context.addInitScript((value) => {
    // React uses the first two random values for its internal event keys.
    // Pinning every call to one number collides those keys, so keep the first
    // two distinct and only then pin the platform draw.
    let call = 0
    Math.random = () => {
      call += 1
      if (call === 1) return 0.13
      if (call === 2) return 0.72
      return value
    }
  }, PLATFORMS[platform].random)
  if (permission) {
    await context.addInitScript((result) => {
      class MockOrientationEvent extends Event {
        constructor(type, values = {}) {
          super(type)
          this.beta = values.beta ?? null
          this.gamma = values.gamma ?? null
        }
        static async requestPermission() { return result }
      }
      Object.defineProperty(window, 'DeviceOrientationEvent', { value: MockOrientationEvent, configurable: true })
    }, permission)
  }
  return context
}

async function openPage(context, platform) {
  const requests = []
  context.on('request', (request) => requests.push(new URL(request.url()).pathname))
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await expect(page.locator('.showcase[data-ready="true"]')).toBeVisible({ timeout: 180000 })
  const fixture = PLATFORMS[platform]
  await expect(page.locator('.showcase')).toHaveAttribute('data-platform', platform)
  await expect(page.getByRole('img', { name: `A floating ${fixture.system} cartridge with a ${fixture.game} label` })).toBeVisible()
  await expect(page.locator('.showcase-system')).toHaveText(fixture.system)
  await expect(page.locator('.showcase-game')).toHaveText(fixture.game)
  // Wait for the first painted frame and the reveal transition; software WebGL
  // can take a moment with the larger shells.
  await page.waitForTimeout(3000)
  return { page, requests }
}

async function expectOnlyPlatform(requests, platform) {
  for (const other of Object.keys(PLATFORMS)) {
    const modelRequested = requests.some((path) => path.startsWith(`/models/${other}/`))
    assert.equal(modelRequested, other === platform, `only the ${platform} shell should be requested`)
  }
  assert.equal(requests.includes(PLATFORMS[platform].label), true, `the ${platform} label should be requested`)
  assert.equal(requests.some((path) => path.startsWith('/api/')), false, 'the page must not fetch an API')
}

async function fits(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1)
}

async function dispatchTilt(page, beta, gamma) {
  await page.evaluate(({ beta, gamma }) => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta, gamma }))
  }, { beta, gamma })
}

try {
  // Desktop: the copy, the closed gate, and a cartridge that follows the mouse.
  const desktop = await makeContext({ viewport: { width: 1600, height: 1000 }, platform: 'gba' })
  const { page, requests } = await openPage(desktop, 'gba')
  await expect(page).toHaveTitle(/The object is the archive/)
  await expect(page.locator('h1')).toHaveText('The object is the archive.')
  await expect(page.getByText(/Every release leaves a trace in the plastic/)).toBeVisible()
  await expect(page.getByText('A physical archive')).toBeVisible()
  await expect(page.getByText('Field notes on cartridges')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Access closed' })).toBeDisabled()
  await expect(page.getByText('Opening soon.')).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(1)
  await expectOnlyPlatform(requests, 'gba')
  assert.equal(await fits(page), true, 'desktop home should fit one screen')
  await page.screenshot({ path: 'artifacts/home-desktop.png' })
  console.log('PASS: one GBA, new archive copy, closed access, and no API requests')

  const stage = page.locator('.showcase-stage')
  await page.mouse.move(800, 500)
  await page.waitForTimeout(800)
  const centred = await stage.screenshot()
  await page.waitForTimeout(1600)
  assert.notDeepEqual(centred, await stage.screenshot(), 'the cartridge should float slowly on its own')
  await page.mouse.move(1500, 100)
  await expect(stage).toHaveAttribute('data-input', 'pointer')
  assert.ok(Number(await stage.getAttribute('data-target-x')) > 0.8)
  assert.ok(Math.abs(Number(await stage.getAttribute('data-target-y'))) <= 1)
  await page.waitForTimeout(900)
  assert.notDeepEqual(centred, await stage.screenshot(), 'the rendered cartridge should react to the pointer')
  console.log('PASS: mouse movement gently nudges the rendered cartridge')
  await expect(page.getByRole('button', { name: 'Move with your phone' })).toHaveCount(0)
  await desktop.close()

  // The other three shells, each on the viewport where it is most awkward.
  for (const [platform, viewport, mobile] of [
    ['snes', { width: 1440, height: 900 }, false],
    ['nds', { width: 390, height: 844 }, true],
    ['nes', { width: 320, height: 640 }, true],
  ]) {
    const context = await makeContext({ viewport, platform, mobile })
    const opened = await openPage(context, platform)
    await expectOnlyPlatform(opened.requests, platform)
    assert.equal(await fits(opened.page), true, `${platform} should fit one screen at ${viewport.width}x${viewport.height}`)
    await expect(opened.page.getByRole('button', { name: 'Access closed' })).toBeInViewport()
    await opened.page.screenshot({ path: `artifacts/home-${platform}.png` })
    await context.close()
  }
  console.log('PASS: SNES, DS, and NES shells each load alone and fit their layout')

  // Reduced motion: no float, no pointer response, no tilt response.
  const reducedContext = await makeContext({ viewport: { width: 390, height: 844 }, platform: 'gba', mobile: true, reducedMotion: 'reduce' })
  const reduced = await openPage(reducedContext, 'gba')
  const reducedStage = reduced.page.locator('.showcase-stage')
  await reduced.page.mouse.move(350, 50)
  await dispatchTilt(reduced.page, 35, 10)
  await dispatchTilt(reduced.page, 50, 30)
  await expect(reducedStage).toHaveAttribute('data-input', 'still')
  const first = await reducedStage.screenshot()
  await reduced.page.waitForTimeout(1000)
  assert.deepEqual(first, await reducedStage.screenshot(), 'reduced motion must stop the float and input movement')
  assert.equal(await fits(reduced.page), true, 'reduced-motion phone should fit one screen')
  await reducedContext.close()
  console.log('PASS: reduced motion keeps the cartridge still and fits the phone')

  // iOS asks for motion access from a gesture. Mock only the browser API.
  for (const outcome of ['granted', 'denied']) {
    const context = await makeContext({ viewport: { width: 390, height: 844 }, platform: 'gba', mobile: true, permission: outcome })
    const opened = await openPage(context, 'gba')
    await opened.page.getByRole('button', { name: 'Move with your phone' }).tap()
    if (outcome === 'granted') {
      await expect(opened.page.getByRole('button', { name: 'Move with your phone' })).toHaveCount(0)
      await dispatchTilt(opened.page, 30, 5)
      await dispatchTilt(opened.page, 35, 15)
      await expect(opened.page.locator('.showcase-stage')).toHaveAttribute('data-input', 'tilt')
      assert.ok(Math.abs(Number(await opened.page.locator('.showcase-stage').getAttribute('data-target-x')) - 0.5) < 0.01)
      assert.ok(Math.abs(Number(await opened.page.locator('.showcase-stage').getAttribute('data-target-y')) + 0.25) < 0.01)
    } else {
      await expect(opened.page.getByText('Tilt unavailable')).toBeVisible()
      await dispatchTilt(opened.page, 35, 15)
      await expect(opened.page.locator('.showcase-stage')).toHaveAttribute('data-input', 'still')
      await expect(opened.page.getByRole('button', { name: 'Access closed' })).toBeDisabled()
    }
    assert.equal(await fits(opened.page), true, `the ${outcome} tilt prompt should not break the phone layout`)
    await context.close()
  }
  console.log('PASS: permission-based phone tilt works and denial falls back gracefully')

  // Landscape phones use the two-column spread, not a clipped stack.
  for (const [name, viewport, platform] of [
    ['laptop', { width: 1280, height: 720 }, 'gba'],
    ['landscape-phone', { width: 844, height: 390 }, 'snes'],
  ]) {
    const mobile = name === 'landscape-phone'
    const context = await makeContext({ viewport, platform, mobile })
    const opened = await openPage(context, platform)
    assert.equal(await fits(opened.page), true, `${name} should fit one screen`)
    await expect(opened.page.getByRole('button', { name: 'Access closed' })).toBeInViewport()
    await opened.page.screenshot({ path: `artifacts/home-${name}.png` })
    await context.close()
  }
  console.log('PASS: laptop and landscape phone layouts fit one screen')

  assert.deepEqual(errors, [], 'there should be no runtime errors')
  console.log('ALL SHOWCASE CHECKS PASSED')
} catch (error) {
  console.error('CHECK FAILED:', error)
  console.error('Runtime errors:', errors)
  process.exitCode = 1
} finally {
  await browser.close()
}
