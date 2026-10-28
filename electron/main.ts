import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { renderIcon } from './icon'
import { fetchFavicon } from './favicon'

const DATA_FILE = path.join(app.getPath('userData'), 'data.json')
const ICON_DIR = path.join(app.getPath('userData'), 'icon-cache')

fs.mkdirSync(ICON_DIR, { recursive: true })

const HTTP_RE = /^https?:\/\//i
const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/x-icon': 'ico',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}
/** favicon 抓不到时，多久之内不再重试（避免每次启动都空等超时） */
const MISS_TTL = 24 * 60 * 60 * 1000

function readData(): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function writeData(data: unknown): void {
  const tmp = `${DATA_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, DATA_FILE) // 原子写入，避免写一半崩溃导致数据损坏
}

/**
 * 网址图标：抓取 favicon 并按 URL 缓存，抓不到则回落前端字母徽标。
 * 失败会写 .miss 标记，24 小时内不再重复联网。
 */
async function getUrlIcon(url: string): Promise<string | null> {
  const hash = crypto.createHash('md5').update(`${url}|favicon|v1`).digest('hex')
  const base = path.join(ICON_DIR, hash)
  try {
    for (const [mime, ext] of Object.entries(MIME_EXT)) {
      const f = `${base}.${ext}`
      if (fs.existsSync(f)) {
        return `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`
      }
    }
    const missFile = `${base}.miss`
    if (fs.existsSync(missFile)) {
      const t = Number(fs.readFileSync(missFile, 'utf-8')) || 0
      if (Date.now() - t < MISS_TTL) return null
    }
    const fav = await fetchFavicon(url)
    if (!fav) {
      fs.writeFileSync(missFile, String(Date.now()))
      return null
    }
    const ext = MIME_EXT[fav.mime]
    if (!ext) return null
    fs.writeFileSync(`${base}.${ext}`, fav.buf)
    return `data:${fav.mime};base64,${fav.buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * 提取图标并做磁盘缓存。
 * exe/dll 优先解析 PE 资源里的真实图标（Windows 的 getFileIcon 对部分打包过的 exe 只给通用图标），
 * 其余类型走系统图标。缓存 key 带上 mtime，文件换了图标会自动刷新。
 */
async function getIcon(target: string): Promise<string | null> {
  if (!target) return null
  if (HTTP_RE.test(target)) return await getUrlIcon(target)
  try {
    const st = fs.statSync(target)
    const hash = crypto
      .createHash('md5')
      .update(`${target}|${st.mtimeMs}|v2`)
      .digest('hex')
    const cacheFile = path.join(ICON_DIR, `${hash}.png`)
    if (fs.existsSync(cacheFile)) {
      return `data:image/png;base64,${fs.readFileSync(cacheFile).toString('base64')}`
    }
    const fallback = await app.getFileIcon(target, { size: 'large' })
    const png = renderIcon(target, fallback && !fallback.isEmpty() ? fallback : null)
    if (!png) return null
    fs.writeFileSync(cacheFile, png)
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

function createWindow(): void {
  // 打包后 icon 放在 resources/ 下（asar 外），dev 模式读 public/
  const icoPath = [
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(__dirname, '../public/icon.ico'),
  ].find((p) => p && fs.existsSync(p))
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 940,
    minHeight: 600,
    title: `LocalHub v${app.getVersion()}`,
    icon: icoPath,
    backgroundColor: '#f5f6f8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('store:load', () => readData())

  // 版本与运行环境：版本号以 app.getVersion() 为准（打包后读 app.asar/package.json）
  ipcMain.handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    // 直接运行 win-unpacked 里的 electron.exe 时 isPackaged 可能仍是 false，
    // 用 app 路径是否落在 .asar 里做二次判定，避免打包版被标成「开发版」
    appPath: app.getAppPath(),
    dataDir: app.getPath('userData'),
    dataFile: DATA_FILE,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
  }))

  ipcMain.handle('store:save', (_e, data: unknown) => {
    writeData(data)
    return true
  })

  ipcMain.handle('dialog:pick', async (_e, kind: 'file' | 'folder') => {
    const win = BrowserWindow.getFocusedWindow()
    const opts: Electron.OpenDialogOptions = {
      properties: kind === 'folder' ? ['openDirectory'] : ['openFile', 'multiSelections'],
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle('shell:open', async (_e, target: string) => {
    if (!target) return { ok: false, error: '路径为空' }
    // 网址条目交给系统默认浏览器，其余按本地路径打开
    try {
      const proto = new URL(target).protocol
      if (proto === 'http:' || proto === 'https:' || proto === 'mailto:') {
        await shell.openExternal(target)
        return { ok: true }
      }
    } catch {
      /* 不是 URL，按本地路径处理 */
    }
    // 手工编辑回填的路径可能带正斜杠或重复分隔符：fs 能容忍，ShellExecute 不能
    const local = path.win32.normalize(target)
    // 先自查路径，避免把 Electron 的英文错误直接抛给界面
    if (!fs.existsSync(local)) {
      return { ok: false, error: '路径不存在，可能已被移动或删除' }
    }
    const err = await shell.openPath(local)
    return err ? { ok: false, error: `无法打开（${err}）` } : { ok: true }
  })

  ipcMain.handle('shell:reveal', (_e, target: string) => {
    if (!target) return { ok: false, error: '路径为空' }
    const local = path.win32.normalize(target)
    if (!fs.existsSync(local)) return { ok: false, error: '路径不存在，可能已被移动或删除' }
    shell.showItemInFolder(local)
    return { ok: true }
  })

  ipcMain.handle('icons:batch', async (_e, targets: string[]) => {
    const uniq = Array.from(new Set(targets.filter(Boolean)))
    const out: Record<string, string | null> = {}
    await Promise.all(
      uniq.map(async (t) => {
        out[t] = await getIcon(t)
      }),
    )
    return out
  })

  ipcMain.handle('probe:batch', (_e, targets: string[]) => {
    const out: Record<string, { exists: boolean; isDirectory: boolean }> = {}
    for (const t of Array.from(new Set(targets.filter(Boolean)))) {
      if (HTTP_RE.test(t)) {
        // 网址不参与磁盘失效检测
        out[t] = { exists: true, isDirectory: false }
        continue
      }
      try {
        const st = fs.statSync(t)
        out[t] = { exists: true, isDirectory: st.isDirectory() }
      } catch {
        out[t] = { exists: false, isDirectory: false }
      }
    }
    return out
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
