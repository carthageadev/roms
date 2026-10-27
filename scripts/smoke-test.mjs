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

async function openPage(context) {
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await expect(page.locator('.showcase-stage[data-ready="true"]')).toBeVisible({ timeout: 180000 })
  // Allow the first frame and the opacity transition to finish before sampling.
  await page.waitForTimeout(1000)
  return page
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
  const desktop = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const requests = []
  desktop.on('request', request => requests.push(new URL(request.url()).pathname))
  const page = await openPage(desktop)
  const stage = page.locator('.showcase-stage')
  await expect(page.getByRole('img', { name: /Game Boy Advance cartridge/i })).toHaveCount(1)
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(page.locator('h1')).toHaveText('The little details worth keeping.')
  await expect(page.getByText(/physical details of game cartridges/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Access closed' })).toBeDisabled()
  await expect(page.getByText('Opening soon.')).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  assert.equal(requests.some(path => path.startsWith('/api/')), false, 'the coming-soon page must not fetch an API')
  assert.equal(requests.some(path => path.includes('/models/n64/')), false, 'only the GBA model should be loaded')
  assert.equal(await fits(page), true, 'desktop home should fit one screen')
  await page.screenshot({ path: 'artifacts/home-desktop.png' })
  console.log('PASS: one GBA, archive copy, honest closed-access status, and no API requests')

  // Movement is bounded and actually changes the rendered image.
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
  const nudged = await stage.screenshot()
  assert.notDeepEqual(centred, nudged, 'the rendered cartridge should react to the pointer')
  console.log('PASS: mouse movement gently nudges the rendered cartridge')

  await expect(page.getByRole('button', { name: 'Enable phone tilt' })).toHaveCount(0)
  await desktop.close()

  // Simulate a phone sensor on browsers that do not require permission.
  const automaticPhone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await automaticPhone.addInitScript(() => {
    class MockOrientationEvent extends Event {
      constructor(type, values = {}) { super(type); this.beta = values.beta ?? null; this.gamma = values.gamma ?? null }
    }
    Object.defineProperty(window, 'DeviceOrientationEvent', { value: MockOrientationEvent, configurable: true })
  })
  const tiltPage = await openPage(automaticPhone)
  const tiltStage = tiltPage.locator('.showcase-stage')
  await dispatchTilt(tiltPage, 35, 10)
  await tiltPage.waitForTimeout(500)
  const levelPhone = await tiltStage.screenshot()
  await dispatchTilt(tiltPage, 47, 25)
  await expect(tiltStage).toHaveAttribute('data-input', 'tilt')
  assert.ok(Math.abs(Number(await tiltStage.getAttribute('data-target-x')) - 0.75) < 0.01)
  assert.ok(Math.abs(Number(await tiltStage.getAttribute('data-target-y')) + 0.6) < 0.01)
  await tiltPage.waitForTimeout(900)
  assert.notDeepEqual(levelPhone, await tiltStage.screenshot(), 'the rendered cartridge should react to phone tilt')
  await dispatchTilt(tiltPage, -90, 89)
  assert.ok(Math.abs(Number(await tiltStage.getAttribute('data-target-x'))) <= 1)
  assert.ok(Math.abs(Number(await tiltStage.getAttribute('data-target-y'))) <= 1)
  await automaticPhone.close()
  console.log('PASS: phone tilt is relative to the starting position and bounded')

  for (const [name, viewport] of [
    ['laptop', { width: 1280, height: 720 }],
    ['phone', { width: 390, height: 844 }],
    ['narrow-phone', { width: 320, height: 640 }],
  ]) {
    const isPhone = name !== 'laptop'
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: isPhone, hasTouch: isPhone })
    if (name === 'phone') {
      await context.addInitScript(() => {
        class MockOrientationEvent extends Event {
          constructor(type, values = {}) { super(type); this.beta = values.beta ?? null; this.gamma = values.gamma ?? null }
        }
        Object.defineProperty(window, 'DeviceOrientationEvent', { value: MockOrientationEvent, configurable: true })
      })
    }
    const target = await openPage(context)
    assert.equal(await fits(target), true, `${name} should fit one screen`)
    await expect(target.getByRole('button', { name: 'Access closed' })).toBeInViewport()
    await target.screenshot({ path: `artifacts/home-${name}.png` })
    if (name === 'phone') {
      const phoneStage = target.locator('.showcase-stage')
      await target.mouse.move(350, 50)
      await dispatchTilt(target, 35, 10)
      await dispatchTilt(target, 50, 30)
      await expect(phoneStage).toHaveAttribute('data-input', 'still')
      const first = await phoneStage.screenshot()
      await target.waitForTimeout(1000)
      const second = await phoneStage.screenshot()
      assert.deepEqual(first, second, 'reduced motion must stop the float and input movement')
    }
    await context.close()
  }
  console.log('PASS: laptop and phone layouts fit; reduced motion stops animation')

  // iOS requires a gesture before requestPermission. Mock only the browser API,
  // then exercise the real button and the real orientation listener.
  for (const outcome of ['granted', 'denied']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    await context.addInitScript((result) => {
      class MockOrientationEvent extends Event {
        constructor(type, values = {}) { super(type); this.beta = values.beta ?? null; this.gamma = values.gamma ?? null }
        static async requestPermission() { return result }
      }
      Object.defineProperty(window, 'DeviceOrientationEvent', { value: MockOrientationEvent, configurable: true })
    }, outcome)
    const phone = await openPage(context)
    await phone.getByRole('button', { name: 'Enable phone tilt' }).click()
    if (outcome === 'granted') {
      await expect(phone.getByRole('button', { name: 'Enable phone tilt' })).toHaveCount(0)
      await dispatchTilt(phone, 30, 5)
      await dispatchTilt(phone, 35, 15)
      await expect(phone.locator('.showcase-stage')).toHaveAttribute('data-input', 'tilt')
    } else {
      await expect(phone.getByText('Phone tilt unavailable.')).toBeVisible()
      await expect(phone.getByRole('button', { name: 'Access closed' })).toBeDisabled()
    }
    await context.close()
  }
  assert.deepEqual(errors, [], 'there should be no runtime errors')
  console.log('PASS: permission-based phone tilt works and denial falls back gracefully')
  console.log('ALL SHOWCASE CHECKS PASSED')
} catch (error) {
  console.error('CHECK FAILED:', error)
  console.error('Runtime errors:', errors)
  process.exitCode = 1
} finally {
  await browser.close()
}
