# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 06-responsive.spec.ts >> Fase 6: Responsive y Visual >> 6.2 - vCenter list en desktop (1280x720)
- Location: tests/06-responsive.spec.ts:43:9

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
  20  |   private networkRequests: NetworkRequest[] = []
  21  | 
  22  |   constructor(private page: Page) {}
  23  | 
  24  |   startMonitoring() {
  25  |     this.consoleErrors = []
  26  |     this.networkRequests = []
  27  | 
  28  |     this.page.on('console', (msg: ConsoleMessage) => {
  29  |       if (msg.type() === 'error' || msg.type() === 'warning') {
  30  |         this.consoleErrors.push({
  31  |           timestamp: new Date().toISOString(),
  32  |           type: msg.type(),
  33  |           text: msg.text(),
  34  |           location: msg.location()?.url || '',
  35  |         })
  36  |       }
  37  |     })
  38  | 
  39  |     this.page.on('pageerror', (err: Error) => {
  40  |       this.consoleErrors.push({
  41  |         timestamp: new Date().toISOString(),
  42  |         type: 'pageerror',
  43  |         text: err.message,
  44  |       })
  45  |     })
  46  | 
  47  |     this.page.on('requestfailed', (request: Request) => {
  48  |       this.consoleErrors.push({
  49  |         timestamp: new Date().toISOString(),
  50  |         type: 'requestfailed',
  51  |         text: `${request.method()} ${request.url()} FAILED: ${request.failure()?.errorText || 'unknown'}`,
  52  |       })
  53  |     })
  54  | 
  55  |     this.page.on('response', (response: Response) => {
  56  |       const request = response.request()
  57  |       if (request.url().includes('/api/') || request.url().includes('/auth/')) {
  58  |         this.networkRequests.push({
  59  |           url: request.url(),
  60  |           method: request.method(),
  61  |           status: response.status(),
  62  |           timing: Date.now(),
  63  |         })
  64  |       }
  65  |     })
  66  |   }
  67  | 
  68  |   getConsoleErrors(): ConsoleError[] {
  69  |     return [...this.consoleErrors]
  70  |   }
  71  | 
  72  |   getFilteredConsoleErrors(excludePatterns: string[] = []): ConsoleError[] {
  73  |     return this.consoleErrors.filter(e =>
  74  |       !excludePatterns.some(p => e.text.toLowerCase().includes(p.toLowerCase()))
  75  |     )
  76  |   }
  77  | 
  78  |   getNetworkRequests(): NetworkRequest[] {
  79  |     return [...this.networkRequests]
  80  |   }
  81  | 
  82  |   getFailedApiCalls(): NetworkRequest[] {
  83  |     return this.networkRequests.filter(r => r.status >= 400)
  84  |   }
  85  | 
  86  |   printReport() {
  87  |     const errors = this.getFilteredConsoleErrors()
  88  |     const failedApis = this.getFailedApiCalls()
  89  | 
  90  |     console.log('\n========== TEST CONSOLE REPORT ==========')
  91  |     if (errors.length === 0) {
  92  |       console.log('✅ No console errors detected')
  93  |     } else {
  94  |       console.log(`❌ ${errors.length} console error(s) found:`)
  95  |       errors.forEach(e => console.log(`  [${e.type}] ${e.text}`))
  96  |     }
  97  | 
  98  |     if (failedApis.length > 0) {
  99  |       console.log(`\n⚠️  ${failedApis.length} failed API call(s):`)
  100 |       failedApis.forEach(r => console.log(`  ${r.method} ${r.url} → ${r.status}`))
  101 |     }
  102 |     console.log('========================================\n')
  103 |   }
  104 | 
  105 |   async takeScreenshots(label: string) {
  106 |     await this.page.screenshot({
  107 |       path: `screenshots/${label}.png`,
  108 |       fullPage: true,
  109 |     })
  110 |   }
  111 | 
  112 |   async login(): Promise<string> {
  113 |     await this.page.goto('/login')
  114 |     await this.page.waitForSelector('#username')
  115 | 
  116 |     await this.page.fill('#username', 'admin')
  117 |     await this.page.fill('#password', 'password123')
  118 |     await this.page.click('button[type="submit"]')
  119 | 
> 120 |     await this.page.waitForURL('**/dashboard', { timeout: 15000 })
      |                     ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  121 | 
  122 |     const token = await this.page.evaluate(() => localStorage.getItem('token'))
  123 |     return token || ''
  124 |   }
  125 | 
  126 |   async getJwtPayload(token: string): Promise<any> {
  127 |     try {
  128 |       const parts = token.split('.')
  129 |       if (parts.length !== 3) return null
  130 |       return JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  131 |     } catch {
  132 |       return null
  133 |     }
  134 |   }
  135 | }
  136 | 
```