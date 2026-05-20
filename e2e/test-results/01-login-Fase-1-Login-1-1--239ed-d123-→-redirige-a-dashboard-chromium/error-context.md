# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-login.spec.ts >> Fase 1: Login >> 1.1 - Login exitoso admin/password123 → redirige a /dashboard
- Location: tests/01-login.spec.ts:6:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   Object {
+     "location": "https://vc-ui.playground.net/api/vcenters",
+     "text": "Failed to load resource: the server responded with a status of 500 ()",
+     "timestamp": "2026-05-17T16:13:47.969Z",
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
  4   | test.describe('Fase 1: Login', () => {
  5   | 
  6   |   test('1.1 - Login exitoso admin/password123 → redirige a /dashboard', async ({ page }) => {
  7   |     const helper = new TestHelper(page)
  8   |     helper.startMonitoring()
  9   | 
  10  |     await page.goto('/login')
  11  |     await expect(page.locator('h1')).toContainText('vCenter Provisioner')
  12  | 
  13  |     await helper.takeScreenshots('1.1-login-page')
  14  | 
  15  |     await page.fill('#username', 'admin')
  16  |     await page.fill('#password', 'password123')
  17  |     await page.click('button[type="submit"]')
  18  | 
  19  |     await page.waitForURL('**/dashboard', { timeout: 15000 })
  20  |     expect(page.url()).toContain('/dashboard')
  21  | 
  22  |     await helper.takeScreenshots('1.1-dashboard-after-login')
  23  | 
  24  |     const token = await page.evaluate(() => localStorage.getItem('token'))
  25  |     expect(token).toBeTruthy()
  26  |     expect(token).toMatch(/^eyJ/)
  27  | 
  28  |     helper.printReport()
  29  |     const errors = helper.getFilteredConsoleErrors(['favicon'])
> 30  |     expect(errors).toEqual([])
      |                    ^ Error: expect(received).toEqual(expected) // deep equality
  31  |   })
  32  | 
  33  |   test('1.2 - Credenciales inválidas → muestra error y NO redirige', async ({ page }) => {
  34  |     const helper = new TestHelper(page)
  35  |     helper.startMonitoring()
  36  | 
  37  |     await page.goto('/login')
  38  |     await page.fill('#username', 'admin')
  39  |     await page.fill('#password', 'wrongpassword')
  40  |     await page.click('button[type="submit"]')
  41  | 
  42  |     await page.waitForTimeout(2000)
  43  |     expect(page.url()).toContain('/login')
  44  | 
  45  |     await helper.takeScreenshots('1.2-login-error')
  46  | 
  47  |     const token = await page.evaluate(() => localStorage.getItem('token'))
  48  |     expect(token).toBeNull()
  49  | 
  50  |     helper.printReport()
  51  |   })
  52  | 
  53  |   test('1.3 - Campos vacíos → validación client-side impide submit', async ({ page }) => {
  54  |     const helper = new TestHelper(page)
  55  |     helper.startMonitoring()
  56  | 
  57  |     await page.goto('/login')
  58  |     await page.fill('#username', '')
  59  |     await page.fill('#password', '')
  60  |     await page.click('button[type="submit"]')
  61  | 
  62  |     await page.waitForTimeout(1000)
  63  |     expect(page.url()).toContain('/login')
  64  | 
  65  |     await helper.takeScreenshots('1.3-login-empty-fields')
  66  | 
  67  |     helper.printReport()
  68  |   })
  69  | 
  70  |   test('1.4 - Token en localStorage persiste tras recarga', async ({ page }) => {
  71  |     const helper = new TestHelper(page)
  72  |     helper.startMonitoring()
  73  | 
  74  |     await helper.login()
  75  | 
  76  |     const tokenBefore = await page.evaluate(() => localStorage.getItem('token'))
  77  |     expect(tokenBefore).toBeTruthy()
  78  | 
  79  |     await page.reload()
  80  |     await page.waitForURL('**/dashboard', { timeout: 15000 })
  81  | 
  82  |     const tokenAfter = await page.evaluate(() => localStorage.getItem('token'))
  83  |     expect(tokenAfter).toBe(tokenBefore)
  84  | 
  85  |     await helper.takeScreenshots('1.4-dashboard-after-reload')
  86  | 
  87  |     helper.printReport()
  88  |   })
  89  | 
  90  |   test('1.5 - Token JWT decodificado: payload y expiración', async ({ page }) => {
  91  |     const helper = new TestHelper(page)
  92  |     helper.startMonitoring()
  93  | 
  94  |     await helper.login()
  95  |     const token = await page.evaluate(() => localStorage.getItem('token'))
  96  | 
  97  |     const payload = await helper.getJwtPayload(token || '')
  98  |     console.log('JWT Payload:', JSON.stringify(payload, null, 2))
  99  | 
  100 |     expect(payload).not.toBeNull()
  101 |     expect(payload).toHaveProperty('username', 'admin')
  102 |     expect(payload).toHaveProperty('role', 'admin')
  103 | 
  104 |     if (payload.exp) {
  105 |       const now = Math.floor(Date.now() / 1000)
  106 |       expect(payload.exp).toBeGreaterThan(now)
  107 |       const expiresIn = payload.exp - now
  108 |       console.log(`Token expires in ${expiresIn} seconds (${Math.round(expiresIn / 60)} minutes)`)
  109 |     }
  110 | 
  111 |     helper.printReport()
  112 |   })
  113 | 
  114 |   test('1.6 - Token manipulado en localStorage → redirect a /login', async ({ page }) => {
  115 |     const helper = new TestHelper(page)
  116 |     helper.startMonitoring()
  117 | 
  118 |     await helper.login()
  119 |     await page.evaluate(() => {
  120 |       localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrZXIiLCJyb2xlIjoiYWRtaW4ifQ.fake')
  121 |     })
  122 |     await page.reload()
  123 | 
  124 |     await page.waitForTimeout(3000)
  125 |     await helper.takeScreenshots('1.6-token-manipulated')
  126 | 
  127 |     const currentUrl = page.url()
  128 |     expect(currentUrl).toContain('/login')
  129 | 
  130 |     helper.printReport()
```