// 第二步：把应用文件打成 app.asar 放进 win-unpacked（electron 运行时已就位）
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.join(__dirname, '..')
const dest = path.join(root, 'out', 'win-unpacked')
const staging = path.join(root, '.staging')
const staleDir = path.join(root, 'out-stale')

if (!fs.existsSync(path.join(dest, 'electron.exe'))) {
  console.error('win-unpacked 里没有 electron.exe，先完成运行时复制')
  process.exit(1)
}
for (const d of ['dist', 'dist-electron', 'public']) {
  if (!fs.existsSync(path.join(root, d))) {
    console.error('缺少构建产物:', d)
    process.exit(1)
  }
}

// 移除 electron 自带的默认应用，否则会和我们的 app.asar 抢启动
const defApp = path.join(dest, 'resources', 'default_app.asar')
if (fs.existsSync(defApp)) {
  fs.rmSync(defApp, { force: true })
  console.log('[asar] 已移除 default_app.asar')
}

// 准备 staging
fs.mkdirSync(staleDir, { recursive: true })
if (fs.existsSync(staging)) {
  fs.renameSync(staging, path.join(staleDir, `staging-${Date.now()}`))
}
fs.mkdirSync(staging, { recursive: true })
for (const d of ['dist', 'dist-electron', 'public']) {
  fs.cpSync(path.join(root, d), path.join(staging, d), { recursive: true })
}
fs.copyFileSync(path.join(root, 'package.json'), path.join(staging, 'package.json'))
console.log('[asar] staging 就绪')

const asarBin = path.join(root, 'node_modules', '@electron', 'asar', 'bin', 'asar.js')
const asarOut = path.join(dest, 'resources', 'app.asar')
if (fs.existsSync(asarOut)) {
  fs.renameSync(asarOut, path.join(staleDir, `app-${Date.now()}.asar`))
}
execFileSync(process.execPath, [asarBin, 'pack', staging, asarOut], { stdio: 'inherit' })

const size = fs.statSync(asarOut).size
console.log(`[asar] app.asar = ${(size / 1024).toFixed(1)} KB`)
if (size < 100 * 1024) {
  console.error('[asar] 体积异常，可能是空包')
  process.exit(1)
}
console.log('[asar] 完成')
