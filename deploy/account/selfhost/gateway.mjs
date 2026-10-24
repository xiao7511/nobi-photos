import { createServer } from 'node:http'
import { Buffer } from 'node:buffer'
import { URL } from 'node:url'
import { createServer as smtpServer } from 'node:net'
import { readFileSync } from 'node:fs'
import { timingSafeEqual } from 'node:crypto'
const config = JSON.parse(readFileSync('/run/nobi/gateway.json', 'utf8'))
const mail = new Map(),
  limits = new Map()
const equal = (a, b) =>
  typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const upstream = 'http://auth:9999'
async function authUser(token) {
  const response = await globalThis.fetch(`${upstream}/user`, {
    headers: { Authorization: token },
    signal: globalThis.AbortSignal.timeout(10000),
    redirect: 'error',
  })
  if (!response.ok) return null
  const user = await response.json()
  return user.email_confirmed_at && user.id ? user : null
}
async function body(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 8192) throw new Error('Body too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}
const server = createServer(async (request, response) => {
  const reply = (status, data) => {
    response.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    response.end(JSON.stringify(data))
  }
  const origin = request.headers.origin
  if (origin && config.origins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader(
      'Access-Control-Allow-Headers',
      'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
    )
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  }
  const staging = equal(request.headers['x-nobi-staging-key'], config.stagingKey)
  try {
    const target = new URL(request.url, 'http://gateway')
    if (target.pathname === '/health' && request.method === 'GET') {
      const health = await globalThis.fetch(`${upstream}/health`, {
        signal: globalThis.AbortSignal.timeout(5000),
      })
      return reply(health.ok ? 200 : 503, {
        service: 'nobi-photos-accounts',
        auth: health.ok,
        registrationEnabled: config.publicAuthEnabled === true,
        emailDelivery: config.publicAuthEnabled ? 'configured' : 'isolated-test-capture',
      })
    }
    // Templates are reached only on the private compose network; public nginx denies /templates/.
    if (target.pathname === '/templates/code' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
      return response.end(
        '<p>NOBI Photos verification code</p><p>NOBI_CODE:{{ .Token }}</p><p>Do not share this code. Ignore this email if you did not request it.</p>',
      )
    }
    if (!staging && (!config.publicAuthEnabled || (origin && !config.origins.includes(origin))))
      return reply(503, { message: 'Account registration is not enabled' })
    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      return response.end()
    }
    if (!staging && !equal(request.headers.apikey, config.anonKey))
      return reply(401, { message: 'Invalid application key' })
    if (!staging) {
      const ip = request.headers['x-real-ip'] ?? request.socket.remoteAddress
      const now = Date.now(),
        entry = limits.get(ip) ?? { until: now + 60000, count: 0 }
      if (now > entry.until) {
        entry.until = now + 60000
        entry.count = 0
      }
      entry.count++
      limits.set(ip, entry)
      if (limits.size > 1000) limits.clear()
      if (entry.count > 40) return reply(429, { message: 'Please try again later' })
    }
    if (target.pathname === '/_staging/mail' && staging && request.method === 'POST') {
      const input = await body(request)
      const code = mail.get(input.email)
      if (!code) return reply(404, { message: 'Test mail pending' })
      mail.delete(input.email)
      return reply(200, { code })
    }
    if (
      target.pathname === '/rest/v1/rpc/nobi_member_access' &&
      request.method === 'POST' &&
      !target.search
    ) {
      const input = await body(request)
      if (Object.keys(input).length)
        return reply(400, { message: 'No media or parameters accepted' })
      const user = await authUser(request.headers.authorization ?? '')
      return user
        ? reply(200, ['beautify', 'compose', 'share'])
        : reply(401, { message: 'Verified account required' })
    }
    if (
      target.pathname === '/functions/v1/nobi-delete-account' &&
      request.method === 'POST' &&
      !target.search
    ) {
      const input = await body(request)
      if (Object.keys(input).length) return reply(400, { message: 'No supplied user id accepted' })
      const user = await authUser(request.headers.authorization ?? '')
      if (!user) return reply(401, { message: 'Verified account required' })
      const deleted = await globalThis.fetch(
        `${upstream}/admin/users/${encodeURIComponent(user.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${config.serviceKey}` },
          signal: globalThis.AbortSignal.timeout(10000),
        },
      )
      return deleted.ok
        ? reply(200, { message: 'Account deleted' })
        : reply(503, { message: 'Deletion unavailable' })
    }
    const routes = {
      '/signup': ['POST'],
      '/token': ['POST'],
      '/verify': ['POST'],
      '/logout': ['POST'],
      '/recover': ['POST'],
      '/resend': ['POST'],
      '/user': ['GET', 'PUT'],
    }
    const path = target.pathname.replace(/^\/auth\/v1/, '')
    const queryAllowed =
      !target.search ||
      (path === '/token' &&
        ['?grant_type=password', '?grant_type=refresh_token'].includes(target.search)) ||
      (path === '/logout' && target.search === '?scope=local')
    if (
      !target.pathname.startsWith('/auth/v1/') ||
      !routes[path]?.includes(request.method) ||
      !queryAllowed
    )
      return reply(404, { message: 'Endpoint unavailable' })
    let payload
    if (request.method !== 'GET') {
      const input = await body(request)
      const allowed = [
        'email',
        'password',
        'token',
        'type',
        'refresh_token',
        'code_challenge',
        'code_challenge_method',
        'gotrue_meta_security',
        'data',
      ]
      if (
        Object.keys(input).some((key) => !allowed.includes(key)) ||
        (input.data && Object.keys(input.data).length)
      )
        return reply(400, { message: 'Photo metadata and account role changes are not accepted' })
      payload = JSON.stringify(input)
    }
    const headers = { 'Content-Type': 'application/json' }
    if (request.headers.authorization) headers.Authorization = request.headers.authorization
    const result = await globalThis.fetch(`${upstream}${path}${target.search}`, {
      method: request.method,
      headers,
      body: payload,
      signal: globalThis.AbortSignal.timeout(20000),
      redirect: 'error',
    })
    response.writeHead(result.status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    })
    return response.end(await result.text())
  } catch {
    return reply(503, { message: 'Account service unavailable' })
  }
})
server.maxHeadersCount = 30
server.headersTimeout = 10000
server.requestTimeout = 25000
server.listen(3000, '0.0.0.0')

// Test-only SMTP sink: no relay, external connection or real recipient support.
smtpServer((socket) => {
  socket.setTimeout(10000, () => socket.destroy())
  socket.write('220 NOBI isolated test SMTP\r\n')
  let buffer = '',
    data = '',
    reading = false,
    recipient = ''
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    if (buffer.length + data.length > 65536) return socket.destroy()
    while (buffer.includes('\n')) {
      const end = buffer.indexOf('\n'),
        line = buffer.slice(0, end).replace(/\r$/, '')
      buffer = buffer.slice(end + 1)
      if (reading) {
        if (line !== '.') {
          data += line + '\n'
          continue
        }
        reading = false
        const decoded = data
          .replace(/=\n/g, '')
          .replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        const code = decoded.match(/NOBI_CODE:\s*(\d{6,10})/)
        if (code && recipient.endsWith('@example.invalid')) {
          if (mail.size >= 20) mail.clear()
          mail.set(recipient, code[1])
        }
        data = ''
        socket.write('250 accepted for isolated test\r\n')
        continue
      }
      if (/^EHLO|^HELO/i.test(line)) socket.write('250-nobi-test\r\n250 8BITMIME\r\n')
      else if (/^MAIL FROM:/i.test(line)) socket.write('250 OK\r\n')
      else if (/^RCPT TO:/i.test(line)) {
        recipient = line.match(/<([^>]+)>/)?.[1] ?? ''
        socket.write(
          recipient.endsWith('@example.invalid') ? '250 OK\r\n' : '550 Test recipients only\r\n',
        )
      } else if (/^DATA$/i.test(line)) {
        reading = true
        data = ''
        socket.write('354 Send data\r\n')
      } else if (/^QUIT$/i.test(line)) {
        socket.end('221 Bye\r\n')
      } else if (/^RSET|^NOOP/i.test(line)) socket.write('250 OK\r\n')
      else socket.write('502 Unsupported in test sink\r\n')
    }
  })
  socket.on('error', () => {})
}).listen(1025, '0.0.0.0')
