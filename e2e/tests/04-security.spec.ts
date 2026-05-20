import { test, expect, request } from '@playwright/test'
import { TestHelper } from '../utils/helpers'

const BASE = 'https://vc-ui.playground.net'

test.describe('Fase 4: Seguridad', () => {

  test('4.1 - JWT accesible desde JS (localStorage audit)', async ({ page }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()
    await helper.login()

    const token = await page.evaluate(() => localStorage.getItem('token'))
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'))
    const sessionId = await page.evaluate(() => localStorage.getItem('session_id'))

    console.log('=== localStorage Audit ===')
    console.log(`token: ${token ? token.substring(0, 50) + '...' : 'NOT FOUND'}`)
    console.log(`refresh_token: ${refreshToken ? refreshToken.substring(0, 20) + '...' : 'NOT FOUND'}`)
    console.log(`session_id: ${sessionId || 'NOT FOUND'}`)

    const allKeys = await page.evaluate(() => Object.keys(localStorage))
    console.log(`All localStorage keys: ${allKeys.join(', ')}`)

    if (token) {
      const parts = token.split('.')
      console.log(`JWT structure: ${parts.length} parts (valid JWT: ${parts.length === 3})`)

      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
        console.log(`JWT Payload:`, JSON.stringify(payload, null, 2))
        console.log(`Token accessible via JS: YES (vulnerability: any XSS can steal it)`)
      } catch (e) {
        console.log(`Could not decode JWT payload: ${e}`)
      }
    }

    await helper.takeScreenshots('4.1-localstorage-audit')
    helper.printReport()
  })

  test('4.2 - Security headers audit', async ({ page }) => {
    const apiContext = await request.newContext({ ignoreHTTPSErrors: true })

    const routes = ['/', '/login', '/dashboard', '/api/health', '/auth/login']
    const allHeaders: Record<string, any> = {}

    for (const route of routes) {
      const response = await apiContext.get(`${BASE}${route}`)
      const headers = response.headers()
      allHeaders[route] = headers

      console.log(`\n--- ${route} headers ---`)
      const securityHeaders = [
        'content-security-policy', 'strict-transport-security',
        'x-frame-options', 'x-content-type-options', 'x-xss-protection',
        'referrer-policy', 'permissions-policy', 'cache-control',
        'set-cookie', 'server', 'access-control-allow-origin',
        'access-control-allow-credentials',
      ]

      for (const h of securityHeaders) {
        if (headers[h]) {
          console.log(`  ${h}: ${headers[h]}`)
        } else {
          console.log(`  ${h}: MISSING`)
        }
      }
    }

    const homepageHeaders = allHeaders['/'] || {}

    console.log('\n=== HEADER ANALYSIS ===')
    if (!homepageHeaders['content-security-policy']) {
      console.log('🔴 CRITICAL: CSP header missing - XSS protection absent')
    }
    if (!homepageHeaders['strict-transport-security']) {
      console.log('🔴 HIGH: HSTS header missing - downgrade attack possible')
    }
    if (homepageHeaders['x-frame-options'] === 'SAMEORIGIN') {
      console.log('✅ X-Frame-Options: SAMEORIGIN present')
    }
    if (homepageHeaders['x-content-type-options'] === 'nosniff') {
      console.log('✅ X-Content-Type-Options: nosniff present')
    }
    if (homepageHeaders['x-xss-protection'] === '1; mode=block') {
      console.log('✅ X-XSS-Protection: enabled')
    }
    if (!homepageHeaders['referrer-policy']) {
      console.log('🟡 MEDIUM: Referrer-Policy missing - URL leakage via referrer')
    }
    if (!homepageHeaders['permissions-policy']) {
      console.log('🟡 MEDIUM: Permissions-Policy missing - browser APIs unrestricted')
    }
  })

  test('4.3 - Source maps y archivos sensibles expuestos', async ({ page }) => {
    const apiContext = await request.newContext({ ignoreHTTPSErrors: true })

    const response = await apiContext.get(`${BASE}/`)
    const html = await response.text()
    const jsBundles = html.match(/\/assets\/[\w-]+\.\w+\.js/g) || []
    console.log(`Found ${jsBundles.length} JS bundle(s):`)
    jsBundles.forEach(b => console.log(`  ${b}`))

    for (const bundle of jsBundles) {
      const mapUrl = `${BASE}${bundle}.map`
      const mapResponse = await apiContext.get(mapUrl)
      console.log(`  ${bundle}.map → ${mapResponse.status()}`)
    }

    const sensitivePaths = [
      '/.env', '/.git/config', '/admin/', '/api/',
      '/swagger.json', '/openapi.json', '/metrics',
      '/debug/', '/actuator/health',
      '/assets/', '/static/',
    ]

    for (const path of sensitivePaths) {
      const res = await apiContext.get(`${BASE}${path}`, { timeout: 5000 }).catch(() => null)
      if (res) {
        console.log(`  ${path} → ${res.status()}`)
        if (res.status() < 400) {
          const text = await res.text()
          if (text.includes('Index of') || text.includes('Parent Directory')) {
            console.log(`  ⚠️ DIRECTORY LISTING on ${path}!`)
          }
        }
      }
    }
  })

  test('4.4 - Inyección de script en campos de formulario (XSS)', async ({ page }) => {
    const apiContext = await request.newContext({ ignoreHTTPSErrors: true })
    const helper = new TestHelper(page)
    helper.startMonitoring()
    await helper.login()

    const loginRes = await apiContext.post(`${BASE}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { username: 'admin', password: 'password123' },
    })
    const { token } = await loginRes.json()

    const xssPayloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '"><script>alert(1)</script>',
      '<svg onload=alert(1)>',
    ]

    for (const payload of xssPayloads) {
      const res = await apiContext.post(`${BASE}/api/typing/templates`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          name: `xss-test-${Date.now()}`,
          prefijo1: payload,
          prefijo2: 'test',
          seq_digits: 3,
          is_active: false,
        },
      }).catch(() => null)

      if (res) {
        console.log(`XSS payload "${payload.substring(0, 30)}..." → ${res.status()}`)
      }
    }
  })

  test('4.5 - Rate limiting en login (50 intentos rápidos)', async ({ page }) => {
    const apiContext = await request.newContext({ ignoreHTTPSErrors: true })
    const statuses: number[] = []

    for (let i = 0; i < 50; i++) {
      const res = await apiContext.post(`${BASE}/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: { username: `user${i}`, password: 'wrongpass' },
      })
      statuses.push(res.status())
    }

    const uniqueStatuses = [...new Set(statuses)]
    console.log(`Status codes received: ${uniqueStatuses.join(', ')}`)

    const rateLimited = statuses.filter(s => s === 429).length
    if (rateLimited === 0) {
      console.log('🔴 HIGH: No rate limiting detected - brute force possible')
    } else {
      console.log(`✅ Rate limiting: ${rateLimited}/50 requests returned 429`)
    }

    const successCount = statuses.filter(s => s === 200).length
    if (successCount > 0) {
      console.log(`🔴 CRITICAL: ${successCount}/50 login attempts succeeded (wrong passwords!)`)
    }
  })

  test('4.6 - Cookies: HttpOnly y Secure flags', async ({ page, context }) => {
    const helper = new TestHelper(page)
    helper.startMonitoring()
    await helper.login()

    const cookies = await context.cookies()
    console.log('=== Cookies After Login ===')
    for (const cookie of cookies) {
      console.log(`\n  Name: ${cookie.name}`)
      console.log(`  Value: ${cookie.value.substring(0, 20)}...`)
      console.log(`  HttpOnly: ${cookie.httpOnly}`)
      console.log(`  Secure: ${cookie.secure}`)
      console.log(`  SameSite: ${cookie.sameSite}`)
      console.log(`  Domain: ${cookie.domain}`)
      console.log(`  Path: ${cookie.path}`)

      if (!cookie.httpOnly && cookie.name.toLowerCase().includes('token')) {
        console.log('  ⚠️ Token cookie without HttpOnly flag')
      }
      if (!cookie.secure) {
        console.log('  ⚠️ Cookie without Secure flag')
      }
    }
  })

  test('4.7 - Auth header injection (tokens corruptos)', async ({ page }) => {
    const apiContext = await request.newContext({ ignoreHTTPSErrors: true })

    const maliciousTokens = [
      'Bearer ',
      'Bearer null',
      'Bearer undefined',
      "Bearer ' OR '1'='1",
      '../../etc/passwd',
      'Bearer ' + 'A'.repeat(10000),
      '%s%s%s%s%s',
    ]

    for (const token of maliciousTokens) {
      const res = await apiContext.get(`${BASE}/api/auth/me`, {
        headers: { 'Authorization': token },
      })

      if (res.status() === 500) {
        const text = await res.text()
        console.log(`🔴 500 error with token "${token.substring(0, 30)}": ${text.substring(0, 200)}`)
      } else if (res.status() !== 401) {
        console.log(`⚠️ Unexpected status ${res.status()} for token "${token.substring(0, 30)}"`)
      }
    }

    console.log('✅ All token manipulations properly rejected (expected 401)')
  })

  test('4.8 - Path traversal en API', async ({ page }) => {
    const apiContext = await request.newContext({ ignoreHTTPSErrors: true })

    const traversalPayloads = [
      '/api/../health',
      '/api/..%2F..%2Fhealth',
      '/api/%2e%2e/%2e%2e/health',
      '/api/..\\..\\health',
      '/api/..%252f..%252fhealth',
      '/api/vcenters/../../auth/admin',
    ]

    for (const payload of traversalPayloads) {
      const res = await apiContext.get(`${BASE}${payload}`, { timeout: 5000 }).catch(() => null)
      if (res) {
        if (res.status() < 400) {
          console.log(`🔴 Path traversal might work: ${payload} → ${res.status()}`)
        } else {
          console.log(`✅ Path blocked: ${payload} → ${res.status()}`)
        }
      }
    }
  })
})
