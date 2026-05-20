import { test, expect } from '@playwright/test'
import { TestHelper } from '../utils/helpers'

test.describe('Dashboard Widgets - Data Validation', () => {
  let helper: TestHelper

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page)
    await helper.login()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
  })

  test('should show Total Provisions with a number greater than 0', async ({ page }) => {
    const card = page.locator('p:has-text("Total Provisions") + p')
    await expect(card.first()).toBeVisible()
    const text = await card.first().textContent() || ''
    const num = parseInt(text, 10)
    expect(num, `Total Provisions value "${text}" should be a number > 0`).toBeGreaterThan(0)
  })

  test('should show Success Rate as a percentage', async ({ page }) => {
    const el = page.locator('p:has-text("Success Rate")')
    await expect(el.first()).toBeVisible()
    const parentText = await el.first().locator('..').textContent() || ''
    expect(parentText, `Success Rate "${parentText}" should contain %`).toMatch(/\d+\.?\d*%/)
  })

  test('should show Successful and Failed counts', async ({ page }) => {
    const successEl = page.locator('p:has-text("Successful")').first()
    await expect(successEl).toBeVisible()
    const successParent = await successEl.locator('..').textContent() || ''
    expect(successParent).toMatch(/\d+/)

    const failedEl = page.locator('p:has-text("Failed")').first()
    await expect(failedEl).toBeVisible()
    const failedParent = await failedEl.locator('..').textContent() || ''
    expect(failedParent).toMatch(/\d+/)
  })

  test('should list VM class names in Top VM Classes (not Unknown)', async ({ page }) => {
    const section = page.locator('h3:has-text("Quick Stats")').locator('..')
    await expect(section.first()).toBeVisible()
    const text = await section.first().textContent() || ''
    expect(text, `Top VM Classes should not show "Unknown"`).not.toContain('Unknown')
    expect(text, `Top VM Classes should not show "No data"`).not.toContain('No data')
    expect(text, `Top VM Classes should show class names`).toContain('Gold')
  })

  test('should list vCenter names in Top vCenters (not Unknown)', async ({ page }) => {
    const section = page.locator('h3:has-text("Quick Stats")').locator('..')
    await expect(section.first()).toBeVisible()
    const text = await section.first().textContent() || ''
    expect(text, `Top vCenters should not show "Unknown"`).not.toContain('Unknown')
    expect(text, `Top vCenters should not show "No data"`).not.toContain('No data')
    expect(text, `Top vCenters should show vCenter names`).toContain('vcenter-cloud')
  })

  test('should show VM names in Recent Provisions', async ({ page }) => {
    const section = page.locator('h3:has-text("Recent Provisions")').locator('..')
    await expect(section.first()).toBeVisible()
    const text = await section.first().textContent() || ''
    expect(text, `Recent Provisions should contain VM names`).toMatch(/test-vm-/)
  })
})
