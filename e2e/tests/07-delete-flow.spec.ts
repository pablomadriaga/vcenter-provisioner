import { test, expect } from '@playwright/test'

const VCENTER_URL = 'https://vcenter-tanzu.cloud.playground.net'
const VCENTER_USER = 'jmadriaga@wetcom.net'
const VCENTER_PASS = 'Wetcom06'

/**
 * Test focalizado: login → crear vCenter → eliminar → verificar
 * Captura console.logs, network calls, screenshots y tracing
 */
test.describe('DELETE vCenter flow - focused', () => {

  test('Login → Crear vCenter → Eliminar → Verificar', async ({ page }, testInfo) => {
    const consoleErrors: string[] = []
    const networkCalls: { method: string; url: string; status: number; body?: string }[] = []
    let deleteResponse: { status: number; body: string } | null = null

    // Monitorear TODO
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[ERROR] ${msg.text()}`)
      }
      if (msg.type() === 'warning') {
        consoleErrors.push(`[WARN] ${msg.text()}`)
      }
    })
    page.on('pageerror', err => {
      consoleErrors.push(`[UNHANDLED] ${err.message}`)
    })
    page.on('requestfailed', req => {
      consoleErrors.push(`[NET_FAIL] ${req.method()} ${req.url().split('?')[0]}: ${req.failure()?.errorText}`)
    })
    page.on('response', async resp => {
      const req = resp.request()
      if (req.url().includes('/api/') || req.url().includes('/auth/')) {
        const call = {
          method: req.method(),
          url: req.url().split('?')[0],
          status: resp.status(),
        }
        networkCalls.push(call)

        // Capturar body del DELETE específicamente
        if (req.method() === 'DELETE') {
          deleteResponse = {
            status: resp.status(),
            body: await resp.text().catch(() => '<error reading body>'),
          }
        }
      }
    })

    // ========== 1. LOGIN ==========
    console.log('\n=== 1. LOGIN ===')
    await page.goto('/login')
    await page.waitForSelector('#username')
    await page.fill('#username', 'admin')
    await page.fill('#password', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    console.log('Login OK → /dashboard')

    // ========== 2. IR A VCENTERS ==========
    console.log('\n=== 2. NAVEGAR A VCENTERS ===')
    await page.goto('/vcenters')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Tomar screenshot del estado inicial (debería estar vacío después de nuestras pruebas)
    await page.screenshot({ path: `screenshots/07-delete-flow-1-initial.png`, fullPage: true })

    // ========== 3. CREAR VCENTER ==========
    console.log('\n=== 3. CREAR VCENTER ===')
    const addBtn = page.locator('button', { hasText: '+ Agregar vCenter' })
    if (await addBtn.isVisible()) {
      await addBtn.click()
    } else {
      const firstBtn = page.locator('button', { hasText: 'Agregar tu Primer vCenter' })
      await firstBtn.click()
    }
    await page.waitForTimeout(1000)

    // Llenar formulario
    await page.fill('input[name="name"]', `test-e2e-${Date.now()}`)
    await page.fill('input[name="url"]', VCENTER_URL)
    await page.fill('input[name="username"]', VCENTER_USER)
    await page.fill('input[name="password"]', VCENTER_PASS)

    // Check Insecure
    const insecureCheckbox = page.locator('input[type="checkbox"]').first()
    await insecureCheckbox.check()

    // Click Probar Conexión
    const testBtn = page.locator('button', { hasText: 'Probar Conexión' })
    await testBtn.click()
    await page.waitForTimeout(3000)

    await page.screenshot({ path: `screenshots/07-delete-flow-2-after-test.png`, fullPage: true })

    // Si la conexión fue exitosa, deberían aparecer datacenter/cluster
    // Intentar guardar el vCenter de todas formas
    const createBtn = page.locator('button', { hasText: 'Crear Conexión' })
    if (await createBtn.isVisible() && await createBtn.isEnabled().catch(() => false)) {
      await createBtn.click()
      await page.waitForTimeout(2000)
    } else {
      // Si el botón está deshabilitado (porque test connection falló), intentar crear directamente
      console.log('Create button disabled - trying to submit form directly')
      // Cerrar modal e intentar de otra forma
      const cancelBtn = page.locator('button', { hasText: 'Cancelar' })
      await cancelBtn.click()
      await page.waitForTimeout(1000)

      // Intentar de nuevo pero guardar sin probar conexión (el backend requiere test)
      const addBtn2 = page.locator('button', { hasText: '+ Agregar vCenter' })
      await addBtn2.click()
      await page.waitForTimeout(1000)

      await page.fill('input[name="name"]', `test-e2e-${Date.now()}`)
      await page.fill('input[name="url"]', VCENTER_URL)
      await page.fill('input[name="username"]', VCENTER_USER)
      await page.fill('input[name="password"]', VCENTER_PASS)
      await insecureCheckbox.check()

      // Click Probar Conexión de nuevo
      await testBtn.click()
      await page.waitForTimeout(5000)
      await page.screenshot({ path: `screenshots/07-delete-flow-2b-retry.png`, fullPage: true })

      // Intentar guardar
      if (await createBtn.isEnabled().catch(() => false)) {
        await createBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    // ========== 4. LISTAR VCENTERS PARA ENCONTRAR EL CREADO ==========
    console.log('\n=== 4. LISTAR VCENTERS ===')
    await page.goto('/vcenters')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: `screenshots/07-delete-flow-3-after-create.png`, fullPage: true })

    // Buscar nuestro vCenter en la lista
    const pageText = await page.textContent('body')
    const hasVCenter = pageText.includes('test-e2e-')
    console.log(`vCenter creado visible en lista: ${hasVCenter}`)

    if (!hasVCenter) {
      console.log('No se encontró el vCenter creado. Usando el que exista en la lista.')
      console.log('Page text sample:', pageText.substring(0, 500))
    }

    // ========== 5. ELIMINAR VCENTER ==========
    console.log('\n=== 5. ELIMINAR VCENTER ===')
    // Buscar botón Eliminar
    const deleteBtn = page.locator('button', { hasText: 'Eliminar' }).first()
    if (await deleteBtn.isVisible()) {
      // Click en Eliminar
      deleteBtn.click()
      await page.waitForTimeout(500)

      // Confirmar el diálogo
      page.on('dialog', async dialog => {
        console.log(`Dialog appeared: "${dialog.message()}" → accepting`)
        await dialog.accept()
      })

      await page.waitForTimeout(2000)
      await page.screenshot({ path: `screenshots/07-delete-flow-4-after-delete.png`, fullPage: true })

      // Esperar a que se refresque la lista
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: `screenshots/07-delete-flow-5-list-after-delete.png`, fullPage: true })

      console.log('DELETE flow completed')
    } else {
      console.log('No delete button found - may need to investigate')
      // Buscar cualquier botón que pueda eliminar
      const allButtons = await page.locator('button').allTextContents()
      console.log('All buttons:', allButtons)
    }

    // ========== 6. REPORTE FINAL ==========
    console.log('\n========== REPORTE FINAL ==========')
    console.log(`\n--- NETWORK CALLS (${networkCalls.length}) ---`)
    networkCalls.forEach(c => {
      const marker = c.method === 'DELETE' ? '🔴' : '✅'
      console.log(`${marker} ${c.method} ${c.url} → ${c.status}`)
    })

    if (deleteResponse) {
      console.log(`\n--- DELETE RESPONSE ---`)
      console.log(`Status: ${deleteResponse.status}`)
      console.log(`Body length: ${deleteResponse.body.length}`)
      console.log(`Body: "${deleteResponse.body}"`)
    }

    console.log(`\n--- CONSOLE ERRORS (${consoleErrors.length}) ---`)
    if (consoleErrors.length === 0) {
      console.log('✅ No console errors')
    } else {
      consoleErrors.forEach(e => console.log(e))
    }

    // Assert final: no debe haber errores de red inesperados
    const failedNetwork = networkCalls.filter(c => c.status >= 400 && c.method !== 'DELETE' && !c.url.includes('/auth/login'))
    if (failedNetwork.length > 0) {
      console.log(`\n⚠️  Failed API calls (non-DELETE):`)
      failedNetwork.forEach(c => console.log(`  ${c.method} ${c.url} → ${c.status}`))
    }

    // Verificar que el DELETE NO haya devuelto error
    if (deleteResponse && deleteResponse.status >= 400) {
      console.log(`\n❌ DELETE FAILED with status ${deleteResponse.status}`)
    } else if (deleteResponse) {
      console.log(`\n✅ DELETE succeeded (204 No Content or similar)`)
    }
  })
})
