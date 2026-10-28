// 清理打包过程产生的临时目录（assemble 用「重命名」绕开批量删除限制，
// 因此会留下 out-stale / .staging，这里统一收尾）
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const targets = ['out-stale', '.staging', '.tmp-pkg']

function rmrf(p) {
  if (!fs.existsSync(p)) return 0
  if (!fs.statSync(p).isDirectory()) {
    fs.unlinkSync(p)
    return 1
  }
  let n = 0
  for (const entry of fs.readdirSync(p)) n += rmrf(path.join(p, entry))
  fs.rmdirSync(p)
  return n + 1
}

let total = 0
for (const t of targets) {
  const abs = path.join(root, t)
  const n = rmrf(abs)
  if (n) console.log(`[clean] ${t}: 已删除 ${n} 项`)
  total += n
}
console.log(total ? '[clean] 完成' : '[clean] 无需清理')
