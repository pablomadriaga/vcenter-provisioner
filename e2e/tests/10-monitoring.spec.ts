import { test, expect } from '@playwright/test'
import { TestHelper } from '../utils/helpers'

test.describe('Fase 2: Monitoreo', () => {

  test('10.1 - Monitor page renders service cards', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/login')
    await page.waitForSelector('h1')
    await page.fill('#username', 'admin')
    await page.fill('#password', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    await page.goto('/monitor')
    await page.waitForSelector('text=Service Monitor', { timeout: 10000 })
    await helper.takeScreenshots('10.1-monitor-page')

    const serviceCards = page.locator('[class*="service-card"], [class*="ServiceCard"], [class*="card"]')
    const count = await serviceCards.count()
    console.log(`Service cards found: ${count}`)
    expect(count).toBeGreaterThan(0)

    const unknownDots = page.locator('[class*="bg-gray-400"]')
    const upDots = page.locator('[class*="bg-green-500"]')
    const downDots = page.locator('[class*="bg-red-500"]')

    const unknownCount = await unknownDots.count()
    const upCount = await upDots.count()
    const downCount = await downDots.count()
    console.log(`Status dots - unknown: ${unknownCount}, up: ${upCount}, down: ${downCount}`)

    expect(unknownCount + upCount + downCount).toBeGreaterThan(0)

    helper.printReport()
    const errors = helper.getFilteredConsoleErrors(['favicon'])
    expect(errors).toEqual([])
  })

  test('10.2 - Services have non-unknown status after probes', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/login')
    await page.waitForSelector('h1')
    await page.fill('#username', 'admin')
    await page.fill('#password', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    await page.goto('/monitor')
    await page.waitForTimeout(2000)
    await helper.takeScreenshots('10.2-monitor-after-fix')

    const apiResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/dashboard/monitoring/services-status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.json()
    })

    console.log('Services status response:', JSON.stringify(apiResponse, null, 2))

    expect(Array.isArray(apiResponse)).toBe(true)

    if (apiResponse.length > 0) {
      const unknownServices = apiResponse.filter(s => s.status === 'unknown')
      console.log(`Unknown services: ${unknownServices.length}/${apiResponse.length}`)
      expect(unknownServices.length).toBeLessThan(apiResponse.length)
    }

    helper.printReport()
    const errors = helper.getFilteredConsoleErrors(['favicon'])
    expect(errors).toEqual([])
  })

  test('10.3 - Connectivity matrix renders', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/login')
    await page.waitForSelector('h1')
    await page.fill('#username', 'admin')
    await page.fill('#password', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    await page.goto('/monitor')

    const hasDiagram = await page.locator('svg, canvas, [class*="diagram"], [class*="ServiceDiagram"]')
    await expect(hasDiagram).toBeAttached({ timeout: 10000 })

    await helper.takeScreenshots('10.3-connectivity-matrix')
    helper.printReport()
  })
})
