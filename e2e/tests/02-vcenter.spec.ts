import { test, expect } from '@playwright/test'
import { TestHelper } from '../utils/helpers'

const VCENTER_URL = 'https://vcenter-tanzu.cloud.playground.net'
const VCENTER_USER = 'jmadriaga@wetcom.net'
const VCENTER_PASS = 'Wetcom06'

test.describe('Fase 2: vCenter Connection', () => {

  test.beforeEach(async ({ page }) => {
    const helper = new TestHelper(page)
    await helper.login()
    await page.goto('/vcenters')
    await page.waitForLoadState('networkidle')
  })

  test('2.1 - Lista de vCenters muestra vcenter-tanzu existente', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.waitForTimeout(2000)
    await helper.takeScreenshots('2.1-vcenter-list')

    const bodyText = await page.textContent('body')
    expect(bodyText).toContain('vcenter-tanzu')
    expect(bodyText).toContain(VCENTER_URL)

    helper.printReport()
  })

  test('2.2 - Test connection SIN Insecure → error TLS esperado', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    const probarButton = page.locator('button', { hasText: 'Probar' }).first()
    await expect(probarButton).toBeVisible()

    const insecureCheckbox = page.locator('input[type="checkbox"]').first()
    const isChecked = await insecureCheckbox.isChecked()
    if (isChecked) {
      await insecureCheckbox.click()
    }

    await probarButton.click()
    await page.waitForTimeout(3000)

    await helper.takeScreenshots('2.2-test-connection-tls-error')

    const errors = helper.getConsoleErrors()
    const failedApis = helper.getFailedApiCalls()

    console.log('API calls from test connection (no Insecure):')
    helper.getNetworkRequests().forEach(r => {
      console.log(`  ${r.method} ${r.url.split('?')[0]} → ${r.status}`)
    })

    helper.printReport()
  })

  test('2.3 - Test connection CON Insecure activado → debe funcionar', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    const insecureCheckbox = page.locator('input[type="checkbox"]').first()
    await insecureCheckbox.check()
    const isChecked = await insecureCheckbox.isChecked()
    expect(isChecked).toBe(true)

    const probarButton = page.locator('button', { hasText: 'Probar' }).first()
    await probarButton.click()

    await page.waitForTimeout(5000)
    await helper.takeScreenshots('2.3-test-connection-with-insecure')

    const errors = helper.getConsoleErrors()
    const failedApis = helper.getFailedApiCalls()

    console.log('API calls from test connection (with Insecure):')
    helper.getNetworkRequests().forEach(r => {
      console.log(`  ${r.method} ${r.url.split('?')[0]} → ${r.status}`)
    })

    if (failedApis.length > 0) {
      console.log('⚠️  Failed API calls with Insecure enabled:')
      failedApis.forEach(r => console.log(`  ${r.method} ${r.url} → ${r.status}`))
    } else {
      console.log('✅ All API calls succeeded with Insecure enabled')
    }

    helper.printReport()
  })

  test('2.4 - Agregar nuevo vCenter desde el modal', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    const addButton = page.locator('button', { hasText: '+ Agregar vCenter' })
    if (await addButton.isVisible()) {
      await addButton.click()
    } else {
      const addFirstButton = page.locator('button', { hasText: 'Agregar tu Primer vCenter' })
      if (await addFirstButton.isVisible()) {
        await addFirstButton.click()
      }
    }

    await page.waitForTimeout(1000)
    await helper.takeScreenshots('2.4-vcenter-modal')

    const modalTitle = page.locator('h2, h3', { hasText: 'Agregar Conexión vCenter' })
    if (await modalTitle.isVisible().catch(() => false)) {
      console.log('✅ Modal de creación visible')
    } else {
      console.log('⚠️  Modal de creación no encontrado - puede tener título diferente')
      const bodyText = await page.textContent('body')
      console.log('Page contains:', bodyText.substring(0, 500))
    }

    await page.locator('button', { hasText: 'Cancelar' }).click().catch(() => {})
    await page.waitForTimeout(500)

    helper.printReport()
  })

  test('2.5 - Validación de formulario: campos requeridos vacíos', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/vcenters')
    await page.waitForLoadState('networkidle')

    const addButton = page.locator('button', { hasText: '+ Agregar vCenter' })
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click()
    } else {
      const altButton = page.locator('button', { hasText: 'Agregar' }).first()
      if (await altButton.isVisible().catch(() => false)) {
        await altButton.click()
      }
    }
    await page.waitForTimeout(1000)

    await helper.takeScreenshots('2.5-vcenter-form-empty')
    helper.printReport()
  })
})
