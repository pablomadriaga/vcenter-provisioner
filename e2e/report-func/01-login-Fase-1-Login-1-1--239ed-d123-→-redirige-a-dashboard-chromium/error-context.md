# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-login.spec.ts >> Fase 1: Login >> 1.1 - Login exitoso admin/password123 → redirige a /dashboard
- Location: tests/01-login.spec.ts:6:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img [ref=e8]
      - heading "vCenter Provisioner" [level=1] [ref=e10]
      - paragraph [ref=e11]: Sign in to manage your VMs
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]: Username
        - textbox "Username" [ref=e16]:
          - /placeholder: Enter your username
          - text: admin
      - generic [ref=e17]:
        - generic [ref=e18]: Password
        - textbox "Password" [ref=e19]:
          - /placeholder: Enter your password
          - text: password123
      - button "Sign In" [ref=e20] [cursor=pointer]
    - paragraph [ref=e22]:
      - text: "Demo Credentials:"
      - code [ref=e23]: admin / password123
  - region "Notifications"
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
> 19  |     await page.waitForURL('**/dashboard', { timeout: 15000 })
      |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
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
  30  |     expect(errors).toEqual([])
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
```