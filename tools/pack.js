// 打包辅助：宿主环境的 PATH 可能缺少系统目录，
// 导致 electron-builder 收集依赖时 spawn 子进程报 ENOENT。
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const root = path.join(__dirname, '..')
const sysRoot = process.env.SystemRoot || 'C:\\Windows'
const extra = [
  path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0'),
  path.join(sysRoot, 'System32'),
  sysRoot,
]

const env = { ...process.env }
const sep = ';'
const existing = (env.PATH || env.Path || '').split(sep)
const merged = [...extra, ...existing].filter(Boolean).join(sep)
env.PATH = merged
env.Path = merged
delete env.ELECTRON_RUN_AS_NODE

const cli = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js')
const args = [cli, '--win', '--x64']

// 已手工装配好 win-unpacked 时直接复用，跳过 electron-builder 自己的
// 打包步骤（它会 spawn PowerShell 收集依赖，在受限宿主里会静默失败）
const fs = require('node:fs')
const prepackaged = path.join(root, 'out', 'win-unpacked')
if (fs.existsSync(path.join(prepackaged, 'resources', 'app.asar'))) {
  args.push('--prepackaged', prepackaged)
  console.log('[pack] 复用已装配目录:', prepackaged)
}

console.log('[pack] PATH 前缀:', extra.join(sep))
const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env })
process.exit(r.status ?? 1)
