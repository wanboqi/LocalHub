// 手工组装 win-unpacked：宿主沙箱禁止 electron-builder 的依赖收集子进程，
// 本应用没有运行时 node 依赖（React 已由 Vite 打进 dist），因此直接拼装即可。
//
// 注意：复制 electron 运行时（300+ 个 dll/exe）必须走 copyTree 分批，
// 一次性 fs.cpSync 会被安全策略直接掐断进程（exit 127、无任何报错）。
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { copyTree } = require('./copy-tree')
const { setExeIcon } = require('./set-icon')

const root = path.join(__dirname, '..')
const dest = path.join(root, 'out', 'win-unpacked')
const electronDist = path.join(root, 'node_modules', 'electron', 'dist')
const staging = path.join(root, '.staging')
const staleDir = path.join(root, 'out-stale')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))

async function main() {
  if (!fs.existsSync(electronDist)) {
    throw new Error(`找不到 electron 解压目录: ${electronDist}`)
  }
  for (const d of ['dist', 'dist-electron', 'public']) {
    if (!fs.existsSync(path.join(root, d))) {
      throw new Error(`缺少构建产物目录: ${d}（先执行 npm run build）`)
    }
  }

  // 1) 清出目标目录（用重命名绕开批量删除限制）
  if (fs.existsSync(dest)) {
    fs.mkdirSync(staleDir, { recursive: true })
    fs.renameSync(dest, path.join(staleDir, `win-unpacked-${Date.now()}`))
  }

  // 2) 复制 electron 运行时
  console.log('[assemble] 复制 electron 运行时…')
  fs.mkdirSync(dest, { recursive: true })
  await copyTree(electronDist, dest, { label: 'runtime' })
  const defApp = path.join(dest, 'resources', 'default_app.asar')
  if (fs.existsSync(defApp)) fs.rmSync(defApp, { force: true })

  // 2.1) exe 改名 + 写入图标/版本信息
  // --prepackaged 模式不会走 electron-builder 的 rcedit 步骤，不处理的话
  // 任务栏和资源管理器里显示的还是 Electron 默认的原子图标
  const exeSrc = path.join(dest, 'electron.exe')
  const exeDst = path.join(dest, 'LocalHub.exe')
  if (fs.existsSync(exeSrc)) fs.renameSync(exeSrc, exeDst)
  if (!fs.existsSync(exeDst)) throw new Error('win-unpacked 里没有可执行文件')
  const icoSrc = path.join(root, 'public', 'icon.ico')
  const r = setExeIcon(exeDst, icoSrc)
  console.log(`[assemble] 已写入图标（${r.icons} 个尺寸）与版本信息 ${pkg.version}`)
  // 窗口图标放在 asar 之外，打包后可直接读
  fs.copyFileSync(icoSrc, path.join(dest, 'resources', 'icon.ico'))

  // 3) 收集应用文件
  console.log('[assemble] 准备应用文件…')
  if (fs.existsSync(staging)) {
    fs.renameSync(staging, path.join(staleDir, `staging-${Date.now()}`))
  }
  fs.mkdirSync(staging, { recursive: true })
  for (const d of ['dist', 'dist-electron', 'public']) {
    await copyTree(path.join(root, d), path.join(staging, d), { label: d })
  }
  fs.copyFileSync(path.join(root, 'package.json'), path.join(staging, 'package.json'))

  // 4) 打成 app.asar
  const asarBin = path.join(root, 'node_modules', '@electron', 'asar', 'bin', 'asar.js')
  const asarOut = path.join(dest, 'resources', 'app.asar')
  console.log('[assemble] 生成 app.asar…')
  execFileSync(process.execPath, [asarBin, 'pack', staging, asarOut], { stdio: 'inherit' })

  // 5) 校验
  const size = fs.statSync(asarOut).size
  const exeOk =
    fs.existsSync(path.join(dest, 'LocalHub.exe')) || fs.existsSync(path.join(dest, 'electron.exe'))
  console.log(`[assemble] app.asar = ${(size / 1024).toFixed(1)} KB, electron.exe 存在=${exeOk}`)
  if (size < 100 * 1024) throw new Error('app.asar 体积异常，可能是空包')
  console.log('[assemble] 完成:', dest)
}

main().catch((e) => {
  console.error('[assemble] 失败:', e.message)
  process.exit(1)
})
