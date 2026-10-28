import http from 'node:http'
import https from 'node:https'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TIMEOUT = 4000
const MAX_BYTES = 2 * 1024 * 1024

interface Raw {
  buf: Buffer
  mime: string
}

/** 单次 GET：跟随最多 3 次重定向，超时/超大小/非 2xx 一律返回 null */
function request(url: string, redirects = 3): Promise<Raw | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: Raw | null) => {
      if (settled) return
      settled = true
      resolve(v)
    }

    let u: URL
    try {
      u = new URL(url)
    } catch {
      finish(null)
      return
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      finish(null)
      return
    }

    const mod = u.protocol === 'https:' ? https : http
    const req = mod.get(
      url,
      { headers: { 'user-agent': UA, accept: '*/*' }, timeout: TIMEOUT },
      (res) => {
        const status = res.statusCode ?? 0
        const loc = res.headers.location
        if (status >= 300 && status < 400 && loc && redirects > 0) {
          res.resume()
          let next: string
          try {
            next = new URL(loc, url).href
          } catch {
            finish(null)
            return
          }
          void request(next, redirects - 1).then(finish)
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          finish(null)
          return
        }
        const mime = String(res.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
        const chunks: Buffer[] = []
        let total = 0
        res.on('data', (c: Buffer) => {
          total += c.length
          if (total > MAX_BYTES) {
            req.destroy()
            finish({ buf: Buffer.concat(chunks), mime })
            return
          }
          chunks.push(c)
        })
        res.on('end', () => finish({ buf: Buffer.concat(chunks), mime }))
        res.on('error', () => finish(null))
      },
    )
    req.on('timeout', () => {
      req.destroy()
      finish(null)
    })
    req.on('error', () => finish(null))
  })
}

/** 按文件头判断图片类型，比 content-type 可靠（很多 favicon.ico 返回 octet-stream） */
function sniff(buf: Buffer): string | null {
  if (buf.length < 16) return null
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif'
  if (buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1) return 'image/x-icon'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp'
  }
  const head = buf.subarray(0, 256).toString('utf8').toLowerCase()
  if (head.includes('<svg') && head.includes('svg')) return 'image/svg+xml'
  return null
}

function asImage(raw: Raw | null): { buf: Buffer; mime: string } | null {
  if (!raw || raw.buf.length === 0) return null
  const mime = sniff(raw.buf) ?? (raw.mime.startsWith('image/') ? raw.mime : null)
  return mime ? { buf: raw.buf, mime } : null
}

/** 从页面 HTML 里挑图标地址：优先 apple-touch-icon（通常 180px），其次 rel=icon */
function pickIconHref(html: string, base: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? []
  let fallback: string | null = null
  for (const tag of tags) {
    const rel = (/rel\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '').toLowerCase().trim()
    if (!/(icon|mask-icon)$/.test(rel)) continue
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
    if (!href || href.startsWith('data:')) continue
    try {
      const abs = new URL(href, base).href
      if (rel.includes('apple-touch-icon')) return abs
      fallback ??= abs
    } catch {
      /* 忽略非法 href */
    }
  }
  return fallback
}

/** 取网站图标：先试根目录 favicon.ico，失败再解析页面里的 link rel=icon */
export async function fetchFavicon(pageUrl: string): Promise<{ buf: Buffer; mime: string } | null> {
  let origin: string
  try {
    origin = new URL(pageUrl).origin
  } catch {
    return null
  }

  const ico = asImage(await request(`${origin}/favicon.ico`))
  if (ico) return ico

  const html = await request(pageUrl)
  if (!html) return null
  const href = pickIconHref(html.buf.toString('utf8'), pageUrl)
  if (!href) return null
  return asImage(await request(href))
}
