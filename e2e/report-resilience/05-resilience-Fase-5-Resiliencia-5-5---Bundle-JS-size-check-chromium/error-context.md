# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 05-resilience.spec.ts >> Fase 5: Resiliencia >> 5.5 - Bundle JS size check
- Location: tests/05-resilience.spec.ts:125:7

# Error details

```
TypeError: apiRequestContext.get: Protocol "about:" not supported. Expected "http:"
```

# Test source

```ts
  28  |       console.log(`\n=== Failed API Calls ===`)
  29  |       failedApis.forEach(r => console.log(`${r.method} ${r.url.split('?')[0]} → ${r.status}`))
  30  |     }
  31  | 
  32  |     helper.printReport()
  33  |   })
  34  | 
  35  |   test('5.2 - Fallo de red en POST /provision (interceptado)', async ({ page }) => {
  36  |     const helper = new TestHelper(page)
  37  |     helper.startMonitoring()
  38  | 
  39  |     await helper.login()
  40  |     await page.goto('/dashboard')
  41  |     await page.waitForLoadState('networkidle')
  42  |     await page.waitForTimeout(2000)
  43  | 
  44  |     await page.route('**/api/provision', route => {
  45  |       route.abort('connectionrefused')
  46  |     })
  47  | 
  48  |     await page.selectOption('#vm-typification', '1')
  49  |     await page.waitForTimeout(500)
  50  | 
  51  |     const manualInput = page.locator('#vm-manual')
  52  |     if (await manualInput.isVisible().catch(() => false)) {
  53  |       await manualInput.fill('appserver')
  54  |     }
  55  | 
  56  |     const crearBtn = page.locator('button', { hasText: 'Crear VM' })
  57  |     if (await crearBtn.isVisible().catch(() => false) && await crearBtn.isEnabled().catch(() => false)) {
  58  |       await crearBtn.click()
  59  |       await page.waitForTimeout(3000)
  60  |       await helper.takeScreenshots('5.2-network-error-provision')
  61  |     }
  62  | 
  63  |     await page.unroute('**/api/provision')
  64  | 
  65  |     const errors = helper.getConsoleErrors()
  66  |     console.log(`Errors after network abort: ${errors.length}`)
  67  |     errors.forEach(e => console.log(`[${e.type}] ${e.text}`))
  68  | 
  69  |     helper.printReport()
  70  |   })
  71  | 
  72  |   test('5.3 - Red lenta simulada (delay 5s en API calls)', async ({ page }) => {
  73  |     const helper = new TestHelper(page)
  74  |     helper.startMonitoring()
  75  | 
  76  |     await page.route('**/api/**', async route => {
  77  |       await new Promise(r => setTimeout(r, 5000))
  78  |       await route.continue()
  79  |     })
  80  | 
  81  |     await helper.login()
  82  |     await page.waitForTimeout(1000)
  83  |     await helper.takeScreenshots('5.3-slow-network')
  84  | 
  85  |     const spinners = page.locator('[role="progressbar"], [role="status"], .animate-pulse, .loading, [aria-busy="true"]')
  86  |     const spinnerCount = await spinners.count()
  87  |     console.log(`Loading indicators visible: ${spinnerCount}`)
  88  | 
  89  |     await page.unroute('**/api/**')
  90  |     helper.printReport()
  91  |   })
  92  | 
  93  |   test('5.4 - Performance: page load metrics', async ({ page }) => {
  94  |     const helper = new TestHelper(page)
  95  |     helper.startMonitoring()
  96  | 
  97  |     const metrics: Record<string, number> = {}
  98  | 
  99  |     await page.goto('/login', { waitUntil: 'commit' })
  100 |     const startTime = Date.now()
  101 | 
  102 |     await page.waitForLoadState('domcontentloaded')
  103 |     metrics['domContentLoaded'] = Date.now() - startTime
  104 | 
  105 |     await page.waitForLoadState('load')
  106 |     metrics['load'] = Date.now() - startTime
  107 | 
  108 |     await page.waitForLoadState('networkidle')
  109 |     metrics['networkIdle'] = Date.now() - startTime
  110 | 
  111 |     const performanceJson = await page.evaluate(() => JSON.stringify(window.performance.timing))
  112 |     const perf = JSON.parse(performanceJson)
  113 | 
  114 |     console.log('\n=== Page Load Metrics (login page) ===')
  115 |     console.log(`DOM Content Loaded: ${metrics['domContentLoaded']}ms`)
  116 |     console.log(`Page Load: ${metrics['load']}ms`)
  117 |     console.log(`Network Idle: ${metrics['networkIdle']}ms`)
  118 |     console.log(`T TF B: ${perf.responseStart - perf.navigationStart}ms`)
  119 |     console.log(`DOM Interactive: ${perf.domInteractive - perf.navigationStart}ms`)
  120 | 
  121 |     await helper.takeScreenshots('5.4-performance-metrics')
  122 |     helper.printReport()
  123 |   })
  124 | 
  125 |   test('5.5 - Bundle JS size check', async ({ page }) => {
  126 |     const apiContext = await (await import('@playwright/test')).request.newContext()
  127 | 
> 128 |     const response = await apiContext.get(`${page.url().replace(/\/[^/]*$/, '')}/`)
      |                                       ^ TypeError: apiRequestContext.get: Protocol "about:" not supported. Expected "http:"
  129 |     const html = await response.text()
  130 | 
  131 |     const jsBundles = html.match(/\/assets\/[\w-]+\.\w+\.js/g) || []
  132 |     const cssBundles = html.match(/\/assets\/[\w-]+\.\w+\.css/g) || []
  133 | 
  134 |     console.log('\n=== Bundle Analysis ===')
  135 |     let totalJsSize = 0
  136 | 
  137 |     for (const bundle of jsBundles) {
  138 |       const fullUrl = `https://vc-ui.playground.net${bundle}`
  139 |       const res = await apiContext.get(fullUrl)
  140 |       const text = await res.text()
  141 |       const sizeKB = Math.round(text.length / 1024)
  142 |       totalJsSize += sizeKB
  143 |       console.log(`  ${bundle} → ${sizeKB} KB`)
  144 |     }
  145 | 
  146 |     console.log(`\nTotal JS: ${totalJsSize} KB`)
  147 |     console.log(`Total bundles: ${jsBundles.length} JS, ${cssBundles.length} CSS`)
  148 | 
  149 |     const cacheHeaders = response.headers()
  150 |     console.log(`\nCache-Control: ${cacheHeaders['cache-control'] || 'MISSING'}`)
  151 |     console.log(`ETag: ${cacheHeaders['etag'] || 'MISSING'}`)
  152 |   })
  153 | })
  154 | 
```