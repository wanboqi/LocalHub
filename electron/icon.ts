import fs from 'node:fs'
import zlib from 'node:zlib'
import { nativeImage } from 'electron'

/* ---------------- PNG 编码（只处理 RGBA，无第三方依赖） ---------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** rgba 必须为自上而下的非预乘数据 */
export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---------------- PE 资源解析（提取 exe / dll 的内嵌图标） ---------------- */

interface Section {
  vaddr: number
  vsize: number
  rawPtr: number
  rawSize: number
}

interface PEFile {
  fd: number
  sections: Section[]
  rsrcRva: number
  rsrcBase: number // 资源目录在文件中的绝对偏移
  secStart: number // 资源节在文件中的绝对偏移（资源内偏移以节起点为基准）
  size: number
}

function openPE(file: string): PEFile | null {
  let fd: number
  try {
    fd = fs.openSync(file, 'r')
  } catch {
    return null
  }
  try {
    const size = fs.fstatSync(fd).size
    const head = Buffer.alloc(4096)
    const n = fs.readSync(fd, head, 0, 4096, 0)
    if (n < 0x40) throw new Error('too small')
    if (head.readUInt16LE(0) !== 0x5a4d) throw new Error('not mz') // MZ

    const e = head.readUInt32LE(0x3c)
    if (head.readUInt32LE(e) !== 0x4550) throw new Error('not pe')
    const nsec = head.readUInt16LE(e + 6)
    const optSize = head.readUInt16LE(e + 20)
    const optOff = e + 24
    const plus = head.readUInt16LE(optOff) === 0x20b
    const ddOff = optOff + (plus ? 112 : 96)
    if (ddOff + 24 > n) throw new Error('opt truncated')

    const rsrcRva = head.readUInt32LE(ddOff + 16) // data dir[2] = 资源表
    if (!rsrcRva) throw new Error('no rsrc')

    const sections: Section[] = []
    const secOff = optOff + optSize
    for (let i = 0; i < nsec; i++) {
      const o = secOff + i * 40
      if (o + 40 > n) break
      sections.push({
        vsize: head.readUInt32LE(o + 8),
        vaddr: head.readUInt32LE(o + 12),
        rawSize: head.readUInt32LE(o + 16),
        rawPtr: head.readUInt32LE(o + 20),
      })
    }

    const sec = sections.find(
      (s) => rsrcRva >= s.vaddr && rsrcRva < s.vaddr + Math.max(s.vsize, s.rawSize),
    )
    if (!sec) throw new Error('rsrc section not found')

    return { fd, sections, rsrcRva, rsrcBase: rsrcRva - sec.vaddr, secStart: sec.rawPtr, size }
  } catch {
    fs.closeSync(fd)
    return null
  }
}

function readAt(pe: PEFile, offset: number, length: number): Buffer | null {
  if (length <= 0 || offset < 0 || offset + length > pe.size) return null
  const buf = Buffer.alloc(length)
  const n = fs.readSync(pe.fd, buf, 0, length, offset)
  return n === length ? buf : null
}

function rvaToOffset(pe: PEFile, rva: number): number {
  for (const s of pe.sections) {
    if (rva >= s.vaddr && rva < s.vaddr + Math.max(s.vsize, s.rawSize)) {
      return s.rawPtr + (rva - s.vaddr)
    }
  }
  return -1
}

interface ResEntry {
  id: number
  isDir: boolean
  offset: number // 相对资源目录起点
}

function readDir(pe: PEFile, relOffset: number): ResEntry[] {
  const at = pe.secStart + relOffset
  const hdr = readAt(pe, at, 16)
  if (!hdr) return []
  const named = hdr.readUInt16LE(12)
  const ids = hdr.readUInt16LE(14)
  const count = Math.min(named + ids, 4096)
  const body = readAt(pe, at + 16, count * 8)
  if (!body) return []
  const out: ResEntry[] = []
  for (let i = 0; i < count; i++) {
    const nameField = body.readUInt32LE(i * 8)
    const offsetField = body.readUInt32LE(i * 8 + 4)
    out.push({
      id: nameField & 0x7fffffff,
      isDir: (offsetField & 0x80000000) !== 0,
      offset: offsetField & 0x7fffffff,
    })
  }
  return out
}

/** 取某种资源类型下所有条目（忽略语言差异，取第一个） */
function findResourceData(pe: PEFile, typeId: number, nameId?: number): Map<number, Buffer> {
  const result = new Map<number, Buffer>()
  const types = readDir(pe, pe.rsrcBase)
  const type = types.find((t) => t.id === typeId && t.isDir)
  if (!type) return result
  for (const entry of readDir(pe, pe.rsrcBase + type.offset)) {
    if (!entry.isDir) continue
    if (nameId !== undefined && entry.id !== nameId) continue
    const langs = readDir(pe, pe.rsrcBase + entry.offset)
    const lang = langs[0]
    if (!lang || lang.isDir) continue
    const entryAt = pe.secStart + pe.rsrcBase + lang.offset
    const hdr = readAt(pe, entryAt, 16)
    if (!hdr) continue
    const dataRva = hdr.readUInt32LE(0)
    const dataSize = hdr.readUInt32LE(4)
    const off = rvaToOffset(pe, dataRva)
    if (off < 0 || dataSize > 4 * 1024 * 1024) continue
    const data = readAt(pe, off, dataSize)
    if (data) result.set(entry.id, data)
  }
  return result
}

interface GroupEntry {
  width: number
  height: number
  bpp: number
  id: number
}

function parseGroup(blob: Buffer): GroupEntry[] {
  if (blob.length < 6 || blob.readUInt16LE(2) !== 1) return []
  const count = blob.readUInt16LE(4)
  const list: GroupEntry[] = []
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 14
    if (o + 14 > blob.length) break
    list.push({
      width: blob[o] || 256,
      height: blob[o + 1] || 256,
      bpp: blob.readUInt16LE(o + 6),
      id: blob.readUInt16LE(o + 12),
    })
  }
  return list
}

/** DIB → RGBA（支持 32/24 位，24 位用 AND 掩码还原透明） */
function dibToRgba(blob: Buffer): { width: number; height: number; rgba: Buffer } | null {
  if (blob.length < 40) return null
  const headerSize = blob.readUInt32LE(0)
  const width = blob.readInt32LE(4)
  const doubleHeight = blob.readInt32LE(8)
  const bpp = blob.readUInt16LE(14)
  const compression = blob.readUInt32LE(16)
  if (width <= 0 || width > 1024 || doubleHeight <= 0) return null
  if (compression !== 0 || (bpp !== 32 && bpp !== 24)) return null
  const height = Math.floor(doubleHeight / 2)
  if (height <= 0 || height > 1024) return null

  const xorStride = Math.ceil((width * (bpp / 8)) / 4) * 4
  const start = headerSize
  const maskStart = start + xorStride * height
  const maskStride = Math.ceil(width / 32) * 4
  const hasMask = blob.length >= maskStart + maskStride * height
  if (blob.length < start + xorStride * height) return null

  const rgba = Buffer.alloc(width * height * 4)
  let hasAlpha = false
  for (let y = 0; y < height; y++) {
    const srcRow = start + (height - 1 - y) * xorStride // DIB 自下而上
    const maskRow = maskStart + (height - 1 - y) * maskStride
    const dstRow = y * width * 4
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * (bpp / 8)
      const d = dstRow + x * 4
      rgba[d] = blob[s + 2]
      rgba[d + 1] = blob[s + 1]
      rgba[d + 2] = blob[s]
      let a: number
      if (bpp === 32) {
        a = blob[s + 3]
      } else {
        // AND 掩码：置 1 表示透明
        const transparent = hasMask && (blob[maskRow + (x >> 3)] & (0x80 >> (x & 7))) !== 0
        a = transparent ? 0 : 255
      }
      if (a !== 0) hasAlpha = true
      rgba[d + 3] = a
    }
  }
  if (bpp === 32 && !hasAlpha) {
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255
  }
  return { width, height, rgba }
}

/** 从 exe / dll 内嵌资源取最大的图标 */
function iconFromPE(file: string): Buffer | null {
  const pe = openPE(file)
  const dbg = process.env.LH_ICON_DEBUG ? (...a: unknown[]) => console.log('[icon]', ...a) : null
  if (!pe) {
    dbg?.('openPE failed', file)
    return null
  }
  try {
    const groups = findResourceData(pe, 14) // RT_GROUP_ICON
    const icons = findResourceData(pe, 3) // RT_ICON
    dbg?.('groups', groups.size, 'icons', icons.size, 'rsrcBase', pe.rsrcBase)
    if (groups.size === 0) return null
    if (icons.size === 0) return null

    let best: { score: number; blob: Buffer; entry: GroupEntry } | null = null
    for (const groupBlob of groups.values()) {
      for (const entry of parseGroup(groupBlob)) {
        const blob = icons.get(entry.id)
        if (!blob) continue
        // 优先大尺寸 + 32 位色深
        const score = entry.width * entry.height * 100 + (entry.bpp >= 32 ? 50 : entry.bpp)
        if (!best || score > best.score) best = { score, blob, entry }
      }
    }
    dbg?.('picked', best?.entry)
    if (!best) return null

    if (best.blob.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return best.blob // 本身就是 PNG
    }
    const dib = dibToRgba(best.blob)
    return dib ? encodePng(dib.width, dib.height, dib.rgba) : null
  } catch {
    return null
  } finally {
    try {
      fs.closeSync(pe.fd)
    } catch {
      /* ignore */
    }
  }
}

/* ---------------- 对外：把任意路径变成 64px PNG ---------------- */

const ICON_EXTS = new Set(['.exe', '.dll', '.scr', '.cpl', '.msc', '.ocx'])

export function renderIcon(target: string, fallback: Electron.NativeImage | null): Buffer | null {
  let img: Electron.NativeImage | null = null

  const ext = target.slice(target.lastIndexOf('.')).toLowerCase()
  if (ICON_EXTS.has(ext)) {
    const png = iconFromPE(target)
    if (png) img = nativeImage.createFromBuffer(png)
  } else if (ext === '.ico') {
    img = nativeImage.createFromPath(target)
  }

  if (!img || img.isEmpty()) img = fallback
  if (!img || img.isEmpty()) return null

  const size = img.getSize()
  if (size.width > 64) {
    img = img.resize({ width: 64, height: 64, quality: 'best' })
  }
  const png = img.toPNG()
  return png.length > 0 ? png : null
}
