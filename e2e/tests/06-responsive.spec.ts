import { test, expect } from '@playwright/test'
import { TestHelper } from '../utils/helpers'

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
]

test.describe('Fase 6: Responsive y Visual', () => {

  for (const vp of VIEWPORTS) {
    test(`6.1 - Login page en ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      const helper = new TestHelper(page)
      helper.startMonitoring()

      await page.goto('/login')
      await page.waitForLoadState('networkidle')

      await helper.takeScreenshots(`6.1-login-${vp.name}`)

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      )
      console.log(`${vp.name}: Horizontal scroll: ${hasHorizontalScroll}`)

      await page.fill('#username', 'admin')
      await page.fill('#password', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {})

      await helper.takeScreenshots(`6.1-dashboard-${vp.name}`)

      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      console.log(`${vp.name} dashboard: Horizontal scroll: ${scrollW}`)

      helper.printReport()
    })
  }

  for (const vp of VIEWPORTS) {
    test(`6.2 - vCenter list en ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      const helper = new TestHelper(page)
      helper.startMonitoring()

      await helper.login()
      await page.goto('/vcenters')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      await helper.takeScreenshots(`6.2-vcenters-${vp.name}`)

      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      console.log(`${vp.name}: Horizontal scroll: ${scrollW}`)

      helper.printReport()
    })
  }

  test('6.3 - Accesibilidad: roles y landmarks en dashboard', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await helper.login()
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const headingCount = await page.locator('h1, h2, h3, h4').count()
    console.log(`Headings found: ${headingCount}`)

    const buttonCount = await page.locator('button').count()
    console.log(`Buttons found: ${buttonCount}`)

    const inputCount = await page.locator('input, select, textarea').count()
    console.log(`Form controls found: ${inputCount}`)

    await helper.takeScreenshots('6.3-a11y-dashboard')

    const tabOrder = await page.evaluate(() => {
      const focusable = document.querySelectorAll(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      )
      return Array.from(focusable).map(el => ({
        tag: el.tagName,
        id: el.id,
        type: (el as HTMLInputElement).type || '',
        tabIndex: el.getAttribute('tabindex') || '0',
      }))
    })
    console.log(`Focusable elements: ${tabOrder.length}`)

    helper.printReport()
  })

  for (const vp of VIEWPORTS) {
    test(`6.4 - Provision form en ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      const helper = new TestHelper(page)
      helper.startMonitoring()

      await helper.login()
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      await helper.takeScreenshots(`6.4-provision-${vp.name}`)

      helper.printReport()
    })
  }
})
