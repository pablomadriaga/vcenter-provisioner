import { test, expect } from '@playwright/test'
import { TestHelper } from '../utils/helpers'

test.describe('Fase 1: Login', () => {

  test('1.1 - Login exitoso admin/password123 → redirige a /dashboard', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('vCenter Provisioner')

    await helper.takeScreenshots('1.1-login-page')

    await page.fill('#username', 'admin')
    await page.fill('#password', 'password123')
    await page.click('button[type="submit"]')

    await page.waitForURL('**/dashboard', { timeout: 15000 })
    expect(page.url()).toContain('/dashboard')

    await helper.takeScreenshots('1.1-dashboard-after-login')

    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
    expect(token).toMatch(/^eyJ/)

    helper.printReport()
    const errors = helper.getFilteredConsoleErrors(['favicon'])
    expect(errors).toEqual([])
  })

  test('1.2 - Credenciales inválidas → muestra error y NO redirige', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/login')
    await page.fill('#username', 'admin')
    await page.fill('#password', 'wrongpassword')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/login')

    await helper.takeScreenshots('1.2-login-error')

    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeNull()

    helper.printReport()
  })

  test('1.3 - Campos vacíos → validación client-side impide submit', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/login')
    await page.fill('#username', '')
    await page.fill('#password', '')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/login')

    await helper.takeScreenshots('1.3-login-empty-fields')

    helper.printReport()
  })

  test('1.4 - Token en localStorage persiste tras recarga', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await helper.login()

    const tokenBefore = await page.evaluate(() => localStorage.getItem('token'))
    expect(tokenBefore).toBeTruthy()

    await page.reload()
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    const tokenAfter = await page.evaluate(() => localStorage.getItem('token'))
    expect(tokenAfter).toBe(tokenBefore)

    await helper.takeScreenshots('1.4-dashboard-after-reload')

    helper.printReport()
  })

  test('1.5 - Token JWT decodificado: payload y expiración', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await helper.login()
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const payload = await helper.getJwtPayload(token || '')
    console.log('JWT Payload:', JSON.stringify(payload, null, 2))

    expect(payload).not.toBeNull()
    expect(payload).toHaveProperty('username', 'admin')
    expect(payload).toHaveProperty('role', 'admin')

    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000)
      expect(payload.exp).toBeGreaterThan(now)
      const expiresIn = payload.exp - now
      console.log(`Token expires in ${expiresIn} seconds (${Math.round(expiresIn / 60)} minutes)`)
    }

    helper.printReport()
  })

  test('1.6 - Token manipulado en localStorage → redirect a /login', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await helper.login()
    await page.evaluate(() => {
      localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrZXIiLCJyb2xlIjoiYWRtaW4ifQ.fake')
    })
    await page.reload()

    await page.waitForTimeout(3000)
    await helper.takeScreenshots('1.6-token-manipulated')

    const currentUrl = page.url()
    expect(currentUrl).toContain('/login')

    helper.printReport()
  })
})
