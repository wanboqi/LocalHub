// 分批复制目录：一次性 cpSync 数百个 dll/exe 会被宿主的安全策略直接掐断进程
// （表现为 exit 127、无任何错误输出），这里按小批量 + 间隔复制。
const fs = require('node:fs')
const path = require('node:path')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function copyTree(src, dst, { batch = 20, delay = 60, label = 'copy' } = {}) {
  const dirs = []
  const files = []
  ;(function walk(dir, relBase) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      const rel = relBase ? path.join(relBase, ent.name) : ent.name
      if (ent.isDirectory()) {
        dirs.push(rel)
        walk(full, rel)
      } else {
        files.push(rel)
      }
    }
  })(src, '')

  fs.mkdirSync(dst, { recursive: true })
  for (const d of dirs) fs.mkdirSync(path.join(dst, d), { recursive: true })

  let done = 0
  for (let i = 0; i < files.length; i += batch) {
    for (const rel of files.slice(i, i + batch)) {
      fs.copyFileSync(path.join(src, rel), path.join(dst, rel))
      done++
    }
    if (done % 100 < batch) console.log(`[${label}] ${done}/${files.length}`)
    await sleep(delay)
  }
  console.log(`[${label}] 完成 ${done} 个文件 → ${dst}`)
  return done
}

module.exports = { copyTree, sleep }
