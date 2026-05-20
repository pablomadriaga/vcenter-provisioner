import { Page, ConsoleMessage, Request, Response } from '@playwright/test';

export interface ConsoleError {
  timestamp: string
  type: string
  text: string
  location?: string
}

export interface NetworkRequest {
  url: string
  method: string
  status: number
  timing: number
  body?: string
}

export class TestHelper {
  private consoleErrors: ConsoleError[] = []
  private networkRequests: NetworkRequest[] = []

  constructor(private page: Page) {}

  startMonitoring() {
    this.consoleErrors = []
    this.networkRequests = []

    this.page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        this.consoleErrors.push({
          timestamp: new Date().toISOString(),
          type: msg.type(),
          text: msg.text(),
          location: msg.location()?.url || '',
        })
      }
    })

    this.page.on('pageerror', (err: Error) => {
      this.consoleErrors.push({
        timestamp: new Date().toISOString(),
        type: 'pageerror',
        text: err.message,
      })
    })

    this.page.on('requestfailed', (request: Request) => {
      this.consoleErrors.push({
        timestamp: new Date().toISOString(),
        type: 'requestfailed',
        text: `${request.method()} ${request.url()} FAILED: ${request.failure()?.errorText || 'unknown'}`,
      })
    })

    this.page.on('response', (response: Response) => {
      const request = response.request()
      if (request.url().includes('/api/') || request.url().includes('/auth/')) {
        this.networkRequests.push({
          url: request.url(),
          method: request.method(),
          status: response.status(),
          timing: Date.now(),
        })
      }
    })
  }

  getConsoleErrors(): ConsoleError[] {
    return [...this.consoleErrors]
  }

  getFilteredConsoleErrors(excludePatterns: string[] = []): ConsoleError[] {
    return this.consoleErrors.filter(e =>
      !excludePatterns.some(p => e.text.toLowerCase().includes(p.toLowerCase()))
    )
  }

  getNetworkRequests(): NetworkRequest[] {
    return [...this.networkRequests]
  }

  getFailedApiCalls(): NetworkRequest[] {
    return this.networkRequests.filter(r => r.status >= 400)
  }

  printReport() {
    const errors = this.getFilteredConsoleErrors()
    const failedApis = this.getFailedApiCalls()

    console.log('\n========== TEST CONSOLE REPORT ==========')
    if (errors.length === 0) {
      console.log('✅ No console errors detected')
    } else {
      console.log(`❌ ${errors.length} console error(s) found:`)
      errors.forEach(e => console.log(`  [${e.type}] ${e.text}`))
    }

    if (failedApis.length > 0) {
      console.log(`\n⚠️  ${failedApis.length} failed API call(s):`)
      failedApis.forEach(r => console.log(`  ${r.method} ${r.url} → ${r.status}`))
    }
    console.log('========================================\n')
  }

  async takeScreenshots(label: string) {
    await this.page.screenshot({
      path: `screenshots/${label}.png`,
      fullPage: true,
    })
  }

  async login(): Promise<string> {
    await this.page.goto('/login', { waitUntil: 'networkidle' })

    const usernameInput = this.page.getByRole('textbox', { name: 'Username' })
    const passwordInput = this.page.getByRole('textbox', { name: 'Password' })
    const submitButton = this.page.getByRole('button', { name: 'Sign In' })

    await usernameInput.fill('admin', { timeout: 10000 })
    await passwordInput.fill('password123')
    await submitButton.click()

    await this.page.waitForFunction(() => localStorage.getItem('token') !== null, { timeout: 30000 })
    await this.page.waitForLoadState('networkidle')

    const token = await this.page.evaluate(() => localStorage.getItem('token'))
    return token || ''
  }

  async getJwtPayload(token: string): Promise<any> {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    } catch {
      return null
    }
  }
}
