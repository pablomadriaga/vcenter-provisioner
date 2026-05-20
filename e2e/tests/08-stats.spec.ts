import { test, expect } from '@playwright/test'
import { TestHelper } from '../utils/helpers'

test.describe('Stats Page - Data Validation', () => {
  let helper: TestHelper

  test.beforeEach(async ({ page }) => {
    helper = new TestHelper(page)
    await helper.login()
  })

  test('should show stats widgets with data, valid names, and consistent totals', async ({ page }) => {
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    await expect(page.locator('h1, h2, h3').first()).toBeVisible()

    // --- VM Class names should not be "Unknown" ---
    const vmClassesHeading = page.getByText(/VM Class/i).first()
    await expect(vmClassesHeading).toBeVisible()
    const vmClassesText = await vmClassesHeading.locator('..').textContent() || ''
    expect(vmClassesText, `VM Class widget should not contain "Unknown", got: "${vmClassesText}"`).not.toContain('Unknown')

    // --- vCenter names should not be "Unknown" ---
    const vCentersHeading = page.getByText(/vCenter/i).first()
    await expect(vCentersHeading).toBeVisible()
    const vCentersText = await vCentersHeading.locator('..').textContent() || ''
    expect(vCentersText, `vCenter widget should not contain "Unknown", got: "${vCentersText}"`).not.toContain('Unknown')

    // --- Total Provisions should equal Successful + Failed ---
    const totalLabel = page.getByText(/Total Provisions/i).first()
    await expect(totalLabel).toBeVisible()
    const totalText = await totalLabel.locator('..').textContent() || ''
    const totalMatch = totalText.match(/(\d+)/)
    expect(totalMatch, `Total Provisions should have a numeric value, got: "${totalText}"`).not.toBeNull()
    const total = parseInt(totalMatch![1], 10)

    const successLabel = page.getByText(/Successful/i).first()
    await expect(successLabel).toBeVisible()
    const successText = await successLabel.locator('..').textContent() || ''
    const successMatch = successText.match(/(\d+)/)
    expect(successMatch, `Successful should have a numeric value, got: "${successText}"`).not.toBeNull()
    const successful = parseInt(successMatch![1], 10)

    const failedLabel = page.getByText('Failed').first()
    await expect(failedLabel).toBeVisible()
    const failedCardText = await failedLabel.locator('..').textContent() || ''
    const failedMatch = failedCardText.match(/(\d+)/)
    expect(failedMatch, `Failed should have a numeric value, got: "${failedCardText}"`).not.toBeNull()
    const failed = parseInt(failedMatch![1], 10)

    expect(
      total,
      `Total Provisions (${total}) should equal Successful (${successful}) + Failed (${failed}) = ${successful + failed}`
    ).toBe(successful + failed)
  })
})
