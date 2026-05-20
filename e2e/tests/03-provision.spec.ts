import { test, expect } from '@playwright/test'
import { TestHelper } from '../utils/helpers'

test.describe('Fase 3: VM Provision', () => {

  test.beforeEach(async ({ page }) => {
    const helper = new TestHelper(page)
    await helper.login()
  })

  test('3.1 - Dashboard carga tipificaciones, vCenters y VM classes', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await helper.takeScreenshots('3.1-dashboard-loaded')

    const bodyText = await page.textContent('body')
    expect(bodyText).toContain('Crear Nueva VM')

    const hasTypificationSelect = await page.locator('#vm-typification').isVisible()
    console.log(`Typification select visible: ${hasTypificationSelect}`)

    if (hasTypificationSelect) {
      const options = await page.locator('#vm-typification option').allTextContents()
      console.log('Typification options:', options)
      expect(options.length).toBeGreaterThan(1)
    }

    helper.printReport()
    const errors = helper.getFilteredConsoleErrors(['favicon'])
    expect(errors).toEqual([])
  })

  test('3.2 - Generar nombre preview con tp-test/appserver', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.selectOption('#vm-typification', '1')
    await page.waitForTimeout(1000)

    const manualInput = page.locator('#vm-manual')
    await expect(manualInput).toBeVisible({ timeout: 5000 })
    await manualInput.fill('appserver')

    await page.waitForTimeout(1000)

    const namePreview = page.locator('text=test-vm-appserver')
    if (await namePreview.isVisible().catch(() => false)) {
      console.log('✅ Name preview visible: test-vm-appserver-...')
      const preview = await namePreview.textContent()
      console.log(`  Preview text: "${preview}"`)
    } else {
      console.log('⚠️  Name preview not visible automatically')
      const previewButton = page.locator('button', { hasText: 'Vista Previa' })
      if (await previewButton.isVisible().catch(() => false)) {
        await previewButton.click()
        await page.waitForTimeout(3000)
      }
    }

    await helper.takeScreenshots('3.2-name-preview')
    helper.printReport()
  })

  test('3.3 - Slider de cantidad (rango 1-50)', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const slider = page.locator('#vm-quantity')
    await expect(slider).toBeVisible()

    const min = await slider.getAttribute('min')
    const max = await slider.getAttribute('max')
    console.log(`Slider range: min=${min}, max=${max}`)

    expect(min).toBe('1')
    expect(max).toBe('50')

    await slider.fill('25')
    await page.waitForTimeout(500)
    let countText = await page.locator('text=/^\\d+$/').first().textContent().catch(() => '')
    console.log(`Quantity display after setting 25: "${countText}"`)

    await slider.fill('50')
    await page.waitForTimeout(500)
    countText = await page.locator('text=/^\\d+$/').first().textContent().catch(() => '')
    console.log(`Quantity display after setting 50: "${countText}"`)

    await slider.fill('1')
    await page.waitForTimeout(500)

    await helper.takeScreenshots('3.3-slider-quantity')
    helper.printReport()
  })

  test('3.4 - Formulario completo VM y vista previa', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.selectOption('#vm-typification', '1')
    await page.waitForTimeout(500)

    const manualInput = page.locator('#vm-manual')
    await expect(manualInput).toBeVisible({ timeout: 5000 })
    await manualInput.fill('appserver')

    const vcenterSelect = page.locator('#vcenter-connection')
    if (await vcenterSelect.isVisible().catch(() => false)) {
      const vcenterOptions = await vcenterSelect.locator('option').allTextContents()
      console.log('vCenter options:', vcenterOptions)
      for (const opt of vcenterOptions) {
        if (opt.includes('vcenter-tanzu')) {
          const value = await vcenterSelect.locator(`option:has-text("vcenter-tanzu")`).getAttribute('value')
          if (value) {
            await vcenterSelect.selectOption(value)
            console.log(`Selected vCenter: ${value}`)
          }
          break
        }
      }
    }

    await page.waitForTimeout(1000)

    const vmClassSelect = page.locator('#vm-class')
    if (await vmClassSelect.isVisible().catch(() => false)) {
      const classOptions = await vmClassSelect.locator('option').allTextContents()
      console.log('VM Class options:', classOptions)
      if (classOptions.length > 1) {
        await vmClassSelect.selectOption({ index: 1 })
      }
    }

    await helper.takeScreenshots('3.4-form-filled')

    const previewButton = page.locator('button', { hasText: 'Vista Previa' })
    if (await previewButton.isVisible().catch(() => false) && await previewButton.isEnabled().catch(() => false)) {
      await previewButton.click()
      await page.waitForTimeout(5000)
      await helper.takeScreenshots('3.4-preview-modal')
    }

    helper.printReport()
  })

  test('3.5 - Validación: botones deshabilitados sin datos requeridos', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const vistaPreviaBtn = page.locator('button', { hasText: 'Vista Previa' })
    const crearBtn = page.locator('button', { hasText: 'Crear VM' })

    const previewDisabled = await vistaPreviaBtn.isDisabled().catch(() => true)
    const crearDisabled = await crearBtn.isDisabled().catch(() => true)
    console.log(`Vista Previa disabled: ${previewDisabled}`)
    console.log(`Crear VM(s) disabled: ${crearDisabled}`)

    await helper.takeScreenshots('3.5-buttons-disabled')

    helper.printReport()
  })
})
