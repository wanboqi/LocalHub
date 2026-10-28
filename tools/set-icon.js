// 给 win-unpacked 里的 exe 写入应用图标与版本信息。
// 手工装配（--prepackaged）不会经过 electron-builder 的 rcedit 步骤，
// 不处理的话任务栏/资源管理器里显示的还是 Electron 的默认原子图标。
const fs = require('node:fs')
const path = require('node:path')
const ResEdit = require('resedit')

const root = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))

function setExeIcon(exePath, icoPath) {
  if (!fs.existsSync(exePath)) throw new Error(`找不到 exe: ${exePath}`)
  if (!fs.existsSync(icoPath)) throw new Error(`找不到 ico: ${icoPath}`)

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true })
  const res = ResEdit.NtExecutableResource.from(exe)

  // 1) 图标：替换 exe 里所有图标组（Electron 默认图标通常是 id=1 / lang=1033）
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))
  const icons = iconFile.icons.map((i) => i.data)
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
  if (groups.length === 0) throw new Error('exe 内没有图标资源组，无法替换')
  for (const g of groups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, icons)
  }

  // 2) 版本信息：属性面板/任务栏提示里显示的名称与版本
  const versions = ResEdit.Resource.VersionInfo.fromEntries(res.entries)
  for (const v of versions) {
    v.setStringValues(
      { lang: Number(v.lang) || 1033, codepage: 1200 },
      {
        CompanyName: 'LocalHub',
        ProductName: 'LocalHub',
        FileDescription: 'LocalHub 本地资源管理器',
        FileVersion: pkg.version,
        ProductVersion: pkg.version,
        InternalName: 'LocalHub',
        OriginalFilename: 'LocalHub.exe',
      },
    )
    v.outputToResourceEntries(res.entries)
  }

  res.outputResource(exe)
  // 先写临时文件再改名：exe 被占用时 rename 仍可完成替换
  const tmp = `${exePath}.icon-tmp`
  fs.writeFileSync(tmp, Buffer.from(exe.generate()))
  fs.renameSync(tmp, exePath)
  return { groups: groups.map((g) => `${g.id}/${g.lang}`), icons: icons.length, versions: versions.length }
}

module.exports = { setExeIcon }

if (require.main === module) {
  const exePath = process.argv[2] || path.join(root, 'out', 'win-unpacked', 'LocalHub.exe')
  const icoPath = process.argv[3] || path.join(root, 'public', 'icon.ico')
  try {
    const r = setExeIcon(exePath, icoPath)
    console.log(`[icon] 已写入 ${r.icons} 个尺寸到 ${r.groups.length} 个图标组`, r.groups.join(', '))
    console.log(`[icon] 版本信息 ${pkg.version}，共 ${r.versions} 个语言块`)
  } catch (e) {
    console.error('[icon] 失败:', e.message)
    process.exit(1)
  }
}
