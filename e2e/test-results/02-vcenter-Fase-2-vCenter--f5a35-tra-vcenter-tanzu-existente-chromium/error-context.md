# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02-vcenter.spec.ts >> Fase 2: vCenter Connection >> 2.1 - Lista de vCenters muestra vcenter-tanzu existente
- Location: tests/02-vcenter.spec.ts:17:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "vcenter-tanzu"
Received string:    "
    vCenter Provisioner🏠Home📝Typifications🖥️VM Classes☁️vCenter📊Stats👁️MonitorLogout🏠Home📝Typifications🖥️VM Classes☁️vCenter📊Stats👁️MonitorConexiones vCenterGestionar conexiones a servidores vCenter+ Agregar vCenterNo hay conexiones vCenter configuradas.Agregar tu Primer vCenter© 2026 Pablo Madriaga Engineering. All rights reserved.vCenter Provisioner|Staff Grade✕ErrorNo se pudieron cargar las conexiones vCenter.····
"
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - banner [ref=e5]:
      - generic [ref=e7]:
        - heading "vCenter Provisioner" [level=1] [ref=e9] [cursor=pointer]
        - navigation [ref=e10]:
          - button "🏠Home" [ref=e11] [cursor=pointer]
          - button "📝Typifications" [ref=e12] [cursor=pointer]
          - button "🖥️VM Classes" [ref=e13] [cursor=pointer]
          - button "☁️vCenter" [ref=e14] [cursor=pointer]
          - button "📊Stats" [ref=e15] [cursor=pointer]
          - button "👁️Monitor" [ref=e16] [cursor=pointer]
        - button "Logout" [ref=e18] [cursor=pointer]
    - main [ref=e19]:
      - generic [ref=e20]:
        - generic [ref=e21]:
          - heading "Conexiones vCenter" [level=1] [ref=e22]
          - paragraph [ref=e23]: Gestionar conexiones a servidores vCenter
        - button "+ Agregar vCenter" [ref=e24] [cursor=pointer]
      - generic [ref=e25]:
        - paragraph [ref=e26]: No hay conexiones vCenter configuradas.
        - button "Agregar tu Primer vCenter" [ref=e27] [cursor=pointer]
    - contentinfo [ref=e28]:
      - generic [ref=e30]:
        - paragraph [ref=e31]: © 2026 Pablo Madriaga Engineering. All rights reserved.
        - generic [ref=e32]:
          - generic [ref=e33]: vCenter Provisioner
          - generic [ref=e34]: "|"
          - generic [ref=e35]: Staff Grade
  - region "Notifications":
    - alert [ref=e36]:
      - generic [ref=e37]:
        - generic [ref=e38]: ✕
        - generic [ref=e39]:
          - paragraph [ref=e40]: Error
          - paragraph [ref=e41]: No se pudieron cargar las conexiones vCenter.
        - button "Dismiss notification" [ref=e42] [cursor=pointer]:
          - img [ref=e43]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | import { TestHelper } from '../utils/helpers'
  3   | 
  4   | const VCENTER_URL = 'https://vcenter-tanzu.cloud.playground.net'
  5   | const VCENTER_USER = 'jmadriaga@wetcom.net'
  6   | const VCENTER_PASS = 'Wetcom06'
  7   | 
  8   | test.describe('Fase 2: vCenter Connection', () => {
  9   | 
  10  |   test.beforeEach(async ({ page }) => {
  11  |     const helper = new TestHelper(page)
  12  |     await helper.login()
  13  |     await page.goto('/vcenters')
  14  |     await page.waitForLoadState('networkidle')
  15  |   })
  16  | 
  17  |   test('2.1 - Lista de vCenters muestra vcenter-tanzu existente', async ({ page }) => {
  18  |     const helper = new TestHelper(page)
  19  |     helper.startMonitoring()
  20  | 
  21  |     await page.waitForTimeout(2000)
  22  |     await helper.takeScreenshots('2.1-vcenter-list')
  23  | 
  24  |     const bodyText = await page.textContent('body')
> 25  |     expect(bodyText).toContain('vcenter-tanzu')
      |                      ^ Error: expect(received).toContain(expected) // indexOf
  26  |     expect(bodyText).toContain(VCENTER_URL)
  27  | 
  28  |     helper.printReport()
  29  |   })
  30  | 
  31  |   test('2.2 - Test connection SIN Insecure → error TLS esperado', async ({ page }) => {
  32  |     const helper = new TestHelper(page)
  33  |     helper.startMonitoring()
  34  | 
  35  |     const probarButton = page.locator('button', { hasText: 'Probar' }).first()
  36  |     await expect(probarButton).toBeVisible()
  37  | 
  38  |     const insecureCheckbox = page.locator('input[type="checkbox"]').first()
  39  |     const isChecked = await insecureCheckbox.isChecked()
  40  |     if (isChecked) {
  41  |       await insecureCheckbox.click()
  42  |     }
  43  | 
  44  |     await probarButton.click()
  45  |     await page.waitForTimeout(3000)
  46  | 
  47  |     await helper.takeScreenshots('2.2-test-connection-tls-error')
  48  | 
  49  |     const errors = helper.getConsoleErrors()
  50  |     const failedApis = helper.getFailedApiCalls()
  51  | 
  52  |     console.log('API calls from test connection (no Insecure):')
  53  |     helper.getNetworkRequests().forEach(r => {
  54  |       console.log(`  ${r.method} ${r.url.split('?')[0]} → ${r.status}`)
  55  |     })
  56  | 
  57  |     helper.printReport()
  58  |   })
  59  | 
  60  |   test('2.3 - Test connection CON Insecure activado → debe funcionar', async ({ page }) => {
  61  |     const helper = new TestHelper(page)
  62  |     helper.startMonitoring()
  63  | 
  64  |     const insecureCheckbox = page.locator('input[type="checkbox"]').first()
  65  |     await insecureCheckbox.check()
  66  |     const isChecked = await insecureCheckbox.isChecked()
  67  |     expect(isChecked).toBe(true)
  68  | 
  69  |     const probarButton = page.locator('button', { hasText: 'Probar' }).first()
  70  |     await probarButton.click()
  71  | 
  72  |     await page.waitForTimeout(5000)
  73  |     await helper.takeScreenshots('2.3-test-connection-with-insecure')
  74  | 
  75  |     const errors = helper.getConsoleErrors()
  76  |     const failedApis = helper.getFailedApiCalls()
  77  | 
  78  |     console.log('API calls from test connection (with Insecure):')
  79  |     helper.getNetworkRequests().forEach(r => {
  80  |       console.log(`  ${r.method} ${r.url.split('?')[0]} → ${r.status}`)
  81  |     })
  82  | 
  83  |     if (failedApis.length > 0) {
  84  |       console.log('⚠️  Failed API calls with Insecure enabled:')
  85  |       failedApis.forEach(r => console.log(`  ${r.method} ${r.url} → ${r.status}`))
  86  |     } else {
  87  |       console.log('✅ All API calls succeeded with Insecure enabled')
  88  |     }
  89  | 
  90  |     helper.printReport()
  91  |   })
  92  | 
  93  |   test('2.4 - Agregar nuevo vCenter desde el modal', async ({ page }) => {
  94  |     const helper = new TestHelper(page)
  95  |     helper.startMonitoring()
  96  | 
  97  |     const addButton = page.locator('button', { hasText: '+ Agregar vCenter' })
  98  |     if (await addButton.isVisible()) {
  99  |       await addButton.click()
  100 |     } else {
  101 |       const addFirstButton = page.locator('button', { hasText: 'Agregar tu Primer vCenter' })
  102 |       if (await addFirstButton.isVisible()) {
  103 |         await addFirstButton.click()
  104 |       }
  105 |     }
  106 | 
  107 |     await page.waitForTimeout(1000)
  108 |     await helper.takeScreenshots('2.4-vcenter-modal')
  109 | 
  110 |     const modalTitle = page.locator('h2, h3', { hasText: 'Agregar Conexión vCenter' })
  111 |     if (await modalTitle.isVisible().catch(() => false)) {
  112 |       console.log('✅ Modal de creación visible')
  113 |     } else {
  114 |       console.log('⚠️  Modal de creación no encontrado - puede tener título diferente')
  115 |       const bodyText = await page.textContent('body')
  116 |       console.log('Page contains:', bodyText.substring(0, 500))
  117 |     }
  118 | 
  119 |     await page.locator('button', { hasText: 'Cancelar' }).click().catch(() => {})
  120 |     await page.waitForTimeout(500)
  121 | 
  122 |     helper.printReport()
  123 |   })
  124 | 
  125 |   test('2.5 - Validación de formulario: campos requeridos vacíos', async ({ page }) => {
```