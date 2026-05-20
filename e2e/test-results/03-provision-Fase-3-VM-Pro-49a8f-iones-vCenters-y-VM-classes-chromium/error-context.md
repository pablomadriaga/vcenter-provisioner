# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03-provision.spec.ts >> Fase 3: VM Provision >> 3.1 - Dashboard carga tipificaciones, vCenters y VM classes
- Location: tests/03-provision.spec.ts:11:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 43

- Array []
+ Array [
+   Object {
+     "text": "GET https://vc-ui.playground.net/api/stats/summary?days=7 FAILED: net::ERR_ABORTED",
+     "timestamp": "2026-05-17T16:15:53.943Z",
+     "type": "requestfailed",
+   },
+   Object {
+     "text": "GET https://vc-ui.playground.net/api/vcenters FAILED: net::ERR_ABORTED",
+     "timestamp": "2026-05-17T16:15:53.943Z",
+     "type": "requestfailed",
+   },
+   Object {
+     "text": "GET https://vc-ui.playground.net/api/stats/recent?limit=5 FAILED: net::ERR_ABORTED",
+     "timestamp": "2026-05-17T16:15:53.943Z",
+     "type": "requestfailed",
+   },
+   Object {
+     "text": "GET https://vc-ui.playground.net/api/stats/by-vmclass FAILED: net::ERR_ABORTED",
+     "timestamp": "2026-05-17T16:15:53.943Z",
+     "type": "requestfailed",
+   },
+   Object {
+     "text": "GET https://vc-ui.playground.net/api/vm-classes FAILED: net::ERR_ABORTED",
+     "timestamp": "2026-05-17T16:15:53.943Z",
+     "type": "requestfailed",
+   },
+   Object {
+     "text": "GET https://vc-ui.playground.net/api/typing/templates FAILED: net::ERR_ABORTED",
+     "timestamp": "2026-05-17T16:15:53.943Z",
+     "type": "requestfailed",
+   },
+   Object {
+     "text": "GET https://vc-ui.playground.net/api/stats/by-vcenter FAILED: net::ERR_ABORTED",
+     "timestamp": "2026-05-17T16:15:53.943Z",
+     "type": "requestfailed",
+   },
+   Object {
+     "location": "https://vc-ui.playground.net/api/vcenters",
+     "text": "Failed to load resource: the server responded with a status of 500 ()",
+     "timestamp": "2026-05-17T16:15:54.329Z",
+     "type": "error",
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - banner [ref=e5]:
      - generic [ref=e7]:
        - heading "vCenter Provisioner - Crear Nueva VM" [level=1] [ref=e9] [cursor=pointer]
        - navigation [ref=e10]:
          - button "🏠Home" [ref=e11] [cursor=pointer]
          - button "📝Typifications" [ref=e12] [cursor=pointer]
          - button "🖥️VM Classes" [ref=e13] [cursor=pointer]
          - button "☁️vCenter" [ref=e14] [cursor=pointer]
          - button "📊Stats" [ref=e15] [cursor=pointer]
          - button "👁️Monitor" [ref=e16] [cursor=pointer]
        - button "Logout" [ref=e18] [cursor=pointer]
    - main [ref=e19]:
      - generic [ref=e21]:
        - generic [ref=e22]:
          - generic [ref=e23]:
            - paragraph [ref=e24]: Total Provisions
            - paragraph [ref=e25]: "0"
          - generic [ref=e26]:
            - paragraph [ref=e27]: Success Rate
            - paragraph [ref=e28]: 0.0%
          - generic [ref=e29]:
            - paragraph [ref=e30]: Successful
            - paragraph [ref=e31]: "0"
          - generic [ref=e32]:
            - paragraph [ref=e33]: Failed
            - paragraph [ref=e34]: "0"
        - generic [ref=e35]:
          - generic [ref=e36]:
            - heading "Quick Stats" [level=3] [ref=e37]
            - generic [ref=e38]:
              - generic [ref=e39]:
                - paragraph [ref=e40]: Top VM Classes
                - paragraph [ref=e41]: No data available
              - generic [ref=e42]:
                - paragraph [ref=e43]: Top vCenters
                - paragraph [ref=e44]: No data available
          - generic [ref=e45]:
            - heading "Recent Provisions" [level=3] [ref=e46]
            - paragraph [ref=e48]: No recent provisions
      - generic [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e51]:
            - generic [ref=e52]:
              - heading "Crear Nueva VM" [level=3] [ref=e53]
              - paragraph [ref=e54]: Configurar y aprovisionar nuevas máquinas virtuales
            - generic [ref=e56]:
              - button "Tipificaciones" [ref=e57] [cursor=pointer]
              - button "Clases de VM" [ref=e58] [cursor=pointer]
          - generic [ref=e59]:
            - generic [ref=e60]:
              - generic [ref=e61]: Cantidad de VMs a Crear
              - generic [ref=e62]:
                - generic [ref=e63]:
                  - generic [ref=e64]: Cantidad de VMs
                  - generic [ref=e65]: "1"
                - slider "Cantidad de VMs" [ref=e66] [cursor=pointer]: "1"
                - generic [ref=e67]:
                  - generic [ref=e68]: "1"
                  - generic [ref=e69]: "25"
                  - generic [ref=e70]: "50"
            - generic [ref=e71]:
              - generic [ref=e72]: Tipificación*
              - combobox [ref=e73]:
                - option "Seleccioná una tipificación" [selected]
                - 'option "Servidores de Producción (PROD-SRV-{MANUAL}-4 dígitos)"'
                - 'option "Servidores de Desarrollo (DEV-SRV-{MANUAL}-3 dígitos)"'
                - 'option "Bases de Datos (PROD-DB-{MANUAL}-4 dígitos)"'
                - 'option "Testing QA (QA-TEST-{MANUAL}-3 dígitos)"'
            - generic [ref=e74]:
              - generic [ref=e75]: Conexión vCenter*
              - combobox [ref=e76]:
                - option "No hay vCenters configurados" [selected]
              - paragraph [ref=e77]:
                - text: No hay conexiones vCenter configuradas.
                - link "Agregar una conexión" [ref=e78] [cursor=pointer]:
                  - /url: /vcenters
            - generic [ref=e79]:
              - generic [ref=e80]: Pool de Recursos(opcional)
              - combobox "Pool de Recursos(opcional)" [disabled] [ref=e81]:
                - option "Seleccioná un cluster primero" [selected]
              - paragraph [ref=e82]: Seleccioná un cluster para ver los pools de recursos disponibles.
            - generic [ref=e83]:
              - button "Vista Previa" [disabled] [ref=e84]
              - button "Crear VM(s)" [disabled] [ref=e85]
        - generic [ref=e86]:
          - heading "Vista Previa del Nombre de VM" [level=3] [ref=e89]
          - generic [ref=e90]:
            - img [ref=e92]
            - heading "Seleccioná opciones para previsualizar" [level=3] [ref=e95]
            - paragraph [ref=e96]: Elegí una tipificación y template para previsualizar los nombres de VM
    - contentinfo [ref=e97]:
      - generic [ref=e99]:
        - paragraph [ref=e100]: © 2026 Pablo Madriaga Engineering. All rights reserved.
        - generic [ref=e101]:
          - generic [ref=e102]: vCenter Provisioner
          - generic [ref=e103]: "|"
          - generic [ref=e104]: Staff Grade
  - region "Notifications":
    - alert [ref=e105]:
      - generic [ref=e106]:
        - generic [ref=e107]: ✕
        - generic [ref=e108]:
          - paragraph [ref=e109]: Error
          - paragraph [ref=e110]: No se pudieron cargar las conexiones vCenter
        - button "Dismiss notification" [ref=e111] [cursor=pointer]:
          - img [ref=e112]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | import { TestHelper } from '../utils/helpers'
  3   | 
  4   | test.describe('Fase 3: VM Provision', () => {
  5   | 
  6   |   test.beforeEach(async ({ page }) => {
  7   |     const helper = new TestHelper(page)
  8   |     await helper.login()
  9   |   })
  10  | 
  11  |   test('3.1 - Dashboard carga tipificaciones, vCenters y VM classes', async ({ page }) => {
  12  |     const helper = new TestHelper(page)
  13  |     helper.startMonitoring()
  14  | 
  15  |     await page.goto('/dashboard')
  16  |     await page.waitForLoadState('networkidle')
  17  |     await page.waitForTimeout(2000)
  18  | 
  19  |     await helper.takeScreenshots('3.1-dashboard-loaded')
  20  | 
  21  |     const bodyText = await page.textContent('body')
  22  |     expect(bodyText).toContain('Crear Nueva VM')
  23  | 
  24  |     const hasTypificationSelect = await page.locator('#vm-typification').isVisible()
  25  |     console.log(`Typification select visible: ${hasTypificationSelect}`)
  26  | 
  27  |     if (hasTypificationSelect) {
  28  |       const options = await page.locator('#vm-typification option').allTextContents()
  29  |       console.log('Typification options:', options)
  30  |       expect(options.length).toBeGreaterThan(1)
  31  |     }
  32  | 
  33  |     helper.printReport()
  34  |     const errors = helper.getFilteredConsoleErrors(['favicon'])
> 35  |     expect(errors).toEqual([])
      |                    ^ Error: expect(received).toEqual(expected) // deep equality
  36  |   })
  37  | 
  38  |   test('3.2 - Generar nombre preview con tp-test/appserver', async ({ page }) => {
  39  |     const helper = new TestHelper(page)
  40  |     helper.startMonitoring()
  41  | 
  42  |     await page.goto('/dashboard')
  43  |     await page.waitForLoadState('networkidle')
  44  |     await page.waitForTimeout(2000)
  45  | 
  46  |     await page.selectOption('#vm-typification', '1')
  47  |     await page.waitForTimeout(1000)
  48  | 
  49  |     const manualInput = page.locator('#vm-manual')
  50  |     await expect(manualInput).toBeVisible({ timeout: 5000 })
  51  |     await manualInput.fill('appserver')
  52  | 
  53  |     await page.waitForTimeout(1000)
  54  | 
  55  |     const namePreview = page.locator('text=test-vm-appserver')
  56  |     if (await namePreview.isVisible().catch(() => false)) {
  57  |       console.log('✅ Name preview visible: test-vm-appserver-...')
  58  |       const preview = await namePreview.textContent()
  59  |       console.log(`  Preview text: "${preview}"`)
  60  |     } else {
  61  |       console.log('⚠️  Name preview not visible automatically')
  62  |       const previewButton = page.locator('button', { hasText: 'Vista Previa' })
  63  |       if (await previewButton.isVisible().catch(() => false)) {
  64  |         await previewButton.click()
  65  |         await page.waitForTimeout(3000)
  66  |       }
  67  |     }
  68  | 
  69  |     await helper.takeScreenshots('3.2-name-preview')
  70  |     helper.printReport()
  71  |   })
  72  | 
  73  |   test('3.3 - Slider de cantidad (rango 1-50)', async ({ page }) => {
  74  |     const helper = new TestHelper(page)
  75  |     helper.startMonitoring()
  76  | 
  77  |     await page.goto('/dashboard')
  78  |     await page.waitForLoadState('networkidle')
  79  |     await page.waitForTimeout(1000)
  80  | 
  81  |     const slider = page.locator('#vm-quantity')
  82  |     await expect(slider).toBeVisible()
  83  | 
  84  |     const min = await slider.getAttribute('min')
  85  |     const max = await slider.getAttribute('max')
  86  |     console.log(`Slider range: min=${min}, max=${max}`)
  87  | 
  88  |     expect(min).toBe('1')
  89  |     expect(max).toBe('50')
  90  | 
  91  |     await slider.fill('25')
  92  |     await page.waitForTimeout(500)
  93  |     let countText = await page.locator('text=/^\\d+$/').first().textContent().catch(() => '')
  94  |     console.log(`Quantity display after setting 25: "${countText}"`)
  95  | 
  96  |     await slider.fill('50')
  97  |     await page.waitForTimeout(500)
  98  |     countText = await page.locator('text=/^\\d+$/').first().textContent().catch(() => '')
  99  |     console.log(`Quantity display after setting 50: "${countText}"`)
  100 | 
  101 |     await slider.fill('1')
  102 |     await page.waitForTimeout(500)
  103 | 
  104 |     await helper.takeScreenshots('3.3-slider-quantity')
  105 |     helper.printReport()
  106 |   })
  107 | 
  108 |   test('3.4 - Formulario completo VM y vista previa', async ({ page }) => {
  109 |     const helper = new TestHelper(page)
  110 |     helper.startMonitoring()
  111 | 
  112 |     await page.goto('/dashboard')
  113 |     await page.waitForLoadState('networkidle')
  114 |     await page.waitForTimeout(2000)
  115 | 
  116 |     await page.selectOption('#vm-typification', '1')
  117 |     await page.waitForTimeout(500)
  118 | 
  119 |     const manualInput = page.locator('#vm-manual')
  120 |     await expect(manualInput).toBeVisible({ timeout: 5000 })
  121 |     await manualInput.fill('appserver')
  122 | 
  123 |     const vcenterSelect = page.locator('#vcenter-connection')
  124 |     if (await vcenterSelect.isVisible().catch(() => false)) {
  125 |       const vcenterOptions = await vcenterSelect.locator('option').allTextContents()
  126 |       console.log('vCenter options:', vcenterOptions)
  127 |       for (const opt of vcenterOptions) {
  128 |         if (opt.includes('vcenter-tanzu')) {
  129 |           const value = await vcenterSelect.locator(`option:has-text("vcenter-tanzu")`).getAttribute('value')
  130 |           if (value) {
  131 |             await vcenterSelect.selectOption(value)
  132 |             console.log(`Selected vCenter: ${value}`)
  133 |           }
  134 |           break
  135 |         }
```