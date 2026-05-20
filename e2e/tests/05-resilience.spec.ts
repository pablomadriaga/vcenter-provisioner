import { test, expect } from '@playwright/test'
import { TestHelper } from '../utils/helpers'

test.describe('Fase 5: Resiliencia', () => {

  test('5.1 - Monitoreo de console.errors durante flujo completo', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await helper.login()
    await page.goto('/vcenters')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await helper.takeScreenshots('5.1-full-flow-complete')

    const allErrors = helper.getConsoleErrors()
    console.log(`\n=== Console Errors During Full Flow ===`)
    console.log(`Total console errors/warnings: ${allErrors.length}`)
    allErrors.forEach(e => console.log(`[${e.type}] ${e.text}`))

    const failedApis = helper.getFailedApiCalls()
    if (failedApis.length > 0) {
      console.log(`\n=== Failed API Calls ===`)
      failedApis.forEach(r => console.log(`${r.method} ${r.url.split('?')[0]} → ${r.status}`))
    }

    helper.printReport()
  })

  test('5.2 - Fallo de red en POST /provision (interceptado)', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await helper.login()
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.route('**/api/provision', route => {
      route.abort('connectionrefused')
    })

    await page.selectOption('#vm-typification', '1')
    await page.waitForTimeout(500)

    const manualInput = page.locator('#vm-manual')
    if (await manualInput.isVisible().catch(() => false)) {
      await manualInput.fill('appserver')
    }

    const crearBtn = page.locator('button', { hasText: 'Crear VM' })
    if (await crearBtn.isVisible().catch(() => false) && await crearBtn.isEnabled().catch(() => false)) {
      await crearBtn.click()
      await page.waitForTimeout(3000)
      await helper.takeScreenshots('5.2-network-error-provision')
    }

    await page.unroute('**/api/provision')

    const errors = helper.getConsoleErrors()
    console.log(`Errors after network abort: ${errors.length}`)
    errors.forEach(e => console.log(`[${e.type}] ${e.text}`))

    helper.printReport()
  })

  test('5.3 - Red lenta simulada (delay 5s en API calls)', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.route('**/api/**', async route => {
      await new Promise(r => setTimeout(r, 5000))
      await route.continue()
    })

    await helper.login()
    await page.waitForTimeout(1000)
    await helper.takeScreenshots('5.3-slow-network')

    const spinners = page.locator('[role="progressbar"], [role="status"], .animate-pulse, .loading, [aria-busy="true"]')
    const spinnerCount = await spinners.count()
    console.log(`Loading indicators visible: ${spinnerCount}`)

    await page.unroute('**/api/**')
    helper.printReport()
  })

  test('5.4 - Performance: page load metrics', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    const metrics: Record<string, number> = {}

    await page.goto('/login', { waitUntil: 'commit' })
    const startTime = Date.now()

    await page.waitForLoadState('domcontentloaded')
    metrics['domContentLoaded'] = Date.now() - startTime

    await page.waitForLoadState('load')
    metrics['load'] = Date.now() - startTime

    await page.waitForLoadState('networkidle')
    metrics['networkIdle'] = Date.now() - startTime

    const performanceJson = await page.evaluate(() => JSON.stringify(window.performance.timing))
    const perf = JSON.parse(performanceJson)

    console.log('\n=== Page Load Metrics (login page) ===')
    console.log(`DOM Content Loaded: ${metrics['domContentLoaded']}ms`)
    console.log(`Page Load: ${metrics['load']}ms`)
    console.log(`Network Idle: ${metrics['networkIdle']}ms`)
    console.log(`T TF B: ${perf.responseStart - perf.navigationStart}ms`)
    console.log(`DOM Interactive: ${perf.domInteractive - perf.navigationStart}ms`)

    await helper.takeScreenshots('5.4-performance-metrics')
    helper.printReport()
  })

  test('5.5 - Bundle JS size check', async ({ page }) => {
    const apiContext = await (await import('@playwright/test')).request.newContext()

    const response = await apiContext.get(`${page.url().replace(/\/[^/]*$/, '')}/`)
    const html = await response.text()

    const jsBundles = html.match(/\/assets\/[\w-]+\.\w+\.js/g) || []
    const cssBundles = html.match(/\/assets\/[\w-]+\.\w+\.css/g) || []

    console.log('\n=== Bundle Analysis ===')
    let totalJsSize = 0

    for (const bundle of jsBundles) {
      const fullUrl = `https://vc-ui.playground.net${bundle}`
      const res = await apiContext.get(fullUrl)
      const text = await res.text()
      const sizeKB = Math.round(text.length / 1024)
      totalJsSize += sizeKB
      console.log(`  ${bundle} → ${sizeKB} KB`)
    }

    console.log(`\nTotal JS: ${totalJsSize} KB`)
    console.log(`Total bundles: ${jsBundles.length} JS, ${cssBundles.length} CSS`)

    const cacheHeaders = response.headers()
    console.log(`\nCache-Control: ${cacheHeaders['cache-control'] || 'MISSING'}`)
    console.log(`ETag: ${cacheHeaders['etag'] || 'MISSING'}`)
  })
})
