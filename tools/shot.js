// 冒烟测试用：跑真实主进程，按脚本点击后截图（不参与打包）
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

require(path.join(__dirname, '..', 'dist-electron', 'main.js'))

const steps = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function clickByText(win, selector, text) {
  return win.webContents.executeJavaScript(`(() => {
    const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
    const hit = nodes.find((n) => (n.textContent || '').trim().includes(${JSON.stringify(text)}))
    if (hit) { hit.click(); return true }
    return false
  })()`)
}

app.whenReady().then(async () => {
  await sleep(3500)
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) {
    console.log('no window')
    app.quit()
    return
  }
  win.show()
  win.focus()
  for (const step of steps) {
    const [selector, text] = step.split('::')
    const ok = await clickByText(win, selector, text)
    await sleep(1000)
    const title = await win.webContents.executeJavaScript(
      "document.querySelector('.list-head-wrap h1')?.textContent || 'none'",
    )
    console.log('click', selector, text, ok, '=> title:', title)
  }
  // 窗口在后台时不一定重绘，capturePage 可能拿到旧帧：先丢一帧再取
  await win.webContents.executeJavaScript('new Promise((r) => requestAnimationFrame(() => r(1)))')
  await sleep(600)
  await win.webContents.capturePage()
  await sleep(600)
  const img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, 'shot.png'), img.toPNG())
  console.log('shot saved', img.getSize())
  app.quit()
})
