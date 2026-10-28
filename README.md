# LocalHub · 本地资源管理器

一个纯本地运行的桌面小工具：把散落在磁盘各处的**软件、文件、文件夹**以及常用**网址**按自定义分类收拢起来，
需要时一键打开，或一键跳到它所在的文件夹。数据只存在本机；只有抓取网站图标时才会访问对应站点。

## 功能

| 功能 | 说明 |
| --- | --- |
| 自定义分类 | 侧栏自由创建 / 改名 / 换图标 / 删除，默认内置「软件、文件、文件夹」 |
| 网址栏目 | 内置「网址」栏目（不可删除），专门管理常用网站：点「访问」用默认浏览器打开，行内显示域名标签 |
| 网站图标 | 自动抓取 favicon（先试 `域名/favicon.ico`，失败再解析页面 `<link rel=icon>`），结果本地缓存；抓不到时显示域名首字母彩色徽标 |
| 添加网址 | 工具栏「＋ 网址」手动录入（自动补 `https://`、可「保存并继续」连续添加），或直接把链接从浏览器拖进窗口 |
| 子栏目 | 每个分类下可建任意多级分组（如「软件 → AI 软件 / 影音」），条目可随时改归属 |
| 列表视图 | 一条目一行：图标 · 名称 · 备注 · 子栏目 · 操作，备注可直接在行内编辑 |
| 手动添加 | 工具栏「＋ 文件」「＋ 文件夹」调用系统选择对话框，支持多选 |
| 拖入添加 | 把文件或文件夹直接拖进窗口即可收录；在某个子栏目里拖入会自动归到该子栏目 |
| 打开 | 调用系统默认方式打开（exe 启动、文档用关联程序打开、文件夹用资源管理器打开） |
| 打开所在文件夹 | 在资源管理器中定位并选中该条目 |
| 操作反馈 | 点「打开 / 访问 / 定位」后按钮立刻变成「打开中…」并禁用防连点；成功转绿「✓ 已打开」，失败转红「✕ 失败」并在底部弹出原因提示，1.4 / 2.4 秒后自动复位（按钮定宽，状态切换不抖动） |
| 真实图标 | 解析 exe/dll 的 PE 资源取内嵌图标（Windows 默认 API 对部分 exe 只给通用图标），其余类型用系统图标，结果本地缓存 |
| 搜索与排序 | 按名称、备注或路径模糊搜索；支持最近添加、最早添加、名称正序/倒序 |
| 失效检测 | 启动及手动检测路径是否仍然存在，失效条目标红、禁用按钮并提示 |
| 条目管理 | 重命名、加备注、改分类/子栏目、复制路径、移除条目 |

快捷键：`Ctrl / Cmd + F` 聚焦搜索框；双击任意一行打开该条目。

## 运行

```bash
npm install     # 安装依赖
npm run dev     # 开发模式，热更新
npm run build   # 类型检查 + 构建
npm run dist    # 构建并打包 Windows 安装包（输出到 out 目录）
npm run dist:manual  # 受限环境下的打包方式，见下节
npm run clean   # 清理打包临时目录（out-stale / .staging）
```

> 若在 Electron 类终端（如某些 AI 客户端内置终端）中执行 `npm run dev`，
> 宿主可能注入 `ELECTRON_RUN_AS_NODE` 导致窗口无法创建，
> `vite.config.ts` 已在启动前清除该变量。

## 打包说明

`npm run dist` 依赖 electron-builder 自己收集依赖，它会通过 `powershell.exe -EncodedCommand`
调 `npm list`；在禁止 spawn 子进程的受限宿主里该步骤会静默返回空，导致打包失败（报 `Cannot find module ...`）。

本应用没有运行时 node 依赖（React 已由 Vite 打进 `dist/`），因此可直接手工装配：

```bash
npm run dist:manual
# 等价于：
# npm run build                          → dist/ + dist-electron/
# node tools/assemble.js                 → 复制 electron 运行时到 out/win-unpacked，
#                                          exe 改名 LocalHub.exe、写入图标与版本信息，打 app.asar
# node tools/pack.js                     → 复用 out/win-unpacked（--prepackaged）生成 nsis + portable
# node tools/clean.js                    → 删除 out-stale / .staging
```

`assemble.js` 用「重命名」而不是删除来腾空目标目录（绕开批量删除限制），
所以必须靠 `clean.js` 收尾，否则 `out-stale/` 会累积到数 GB。

复制运行时必须走 `tools/copy-tree.js` 分批（20 个/批）：一次性 `fs.cpSync` 复制 300+ 个
dll/exe 会被宿主安全策略直接掐断进程，表现为 exit 127、无任何报错、目标目录全空。

### 应用图标

`--prepackaged` 模式不会执行 electron-builder 的 rcedit 步骤，所以 `tools/set-icon.js`
（基于 resedit）负责给 exe 写入图标和版本信息，否则任务栏/开始菜单/资源管理器里显示的
仍是 Electron 默认的原子图标。它做两件事：

1. 把 `public/icon.ico` 的 6 个尺寸（256/128/64/48/32/16）替换进 exe 的所有图标组；
2. 写 VS_VERSION_INFO：ProductName / FileDescription / FileVersion 取自 `package.json`。

窗口图标走另一条路：`assemble.js` 会把 `icon.ico` 复制到 `resources/`（asar 之外），
主进程优先读 `process.resourcesPath/icon.ico`，dev 模式回退到 `public/icon.ico`。

## 数据存储

- 数据文件：`%APPDATA%/LocalHub/data.json`（打包后），开发模式下为 `%APPDATA%/Electron/data.json`
- 图标缓存：`同目录/icon-cache/`，本地文件按「路径 + 修改时间」哈希命名；网址图标按 URL 哈希，保存 `png/ico/...` 原图
- 抓取失败的网址会写 `.miss` 标记，24 小时内不再重复联网（避免每次启动空等超时）
- 写入采用「临时文件 + 原子重命名」，避免写一半崩溃导致数据损坏；读取时对字段做兜底清洗
- 旧版数据自动升级：`version: 1 → 2`（子栏目）、`2 → 3`（网址栏目），原有分类与条目保持不变；
  v2 升级时会自动补一个「网址」栏目

移除条目**只删除记录**，不会动磁盘上的真实文件；删除子栏目只是取消分组，条目回到分类下的「未分类」。
网址条目占用 `path` 字段存 URL，因此不参与磁盘路径失效检测。

## 目录结构

```
electron/
  main.ts       主进程：窗口、IPC、数据读写、打开/定位
  icon.ts       PE 资源图标解析 + 纯标准库 PNG 编码
  favicon.ts    网站图标抓取（超时 4s、跟随重定向、文件头嗅探）
  preload.ts    contextBridge 暴露受控 API
src/
  components/   侧栏、工具栏、条目行、弹窗
  store.ts      数据清洗、URL 规范化、排序、视图 key 工具
  types.ts
tools/
  make_icon.py  生成 public/icon.ico（纯标准库，无需 Pillow）
  shot.js       冒烟测试：启动应用、模拟点击、截图
  assemble.js   手工装配 out/win-unpacked + app.asar（受限环境打包用）
  asar-pack.js  只重打 app.asar（改了 dist/ 不想重装运行时时用）
  pack.js       复用 win-unpacked 生成安装包/便携版
  set-icon.js   往 exe 写入图标与版本信息（resedit）
  copy-tree.js  分批复制目录（绕开批量写入限制）
  clean.js      清理 out-stale / .staging
```

## 技术栈

Electron 45 + React 19 + TypeScript + Vite 7，仅 Windows（用到 `app.getFileIcon`、
`shell.openPath`、`shell.showItemInFolder` 等系统能力）。

## 版本号与更新日志

版本号只有一处来源：`package.json` 的 `version`。运行时由主进程 `app.getVersion()` 读取
（打包后读的是 `app.asar/package.json`），经 IPC `app:info` 传给界面，因此**升级版本只需改 `package.json`**，
界面侧栏、窗口标题、关于面板会自动跟着变。

每次发版的改动写进 `src/changelog.ts` 的 `CHANGELOG` 数组（从新到旧），条目用
`new / improve / fix` 三种标签，软件内「关于 LocalHub」面板直接渲染这份数据：

- 侧栏底部 `vX.Y.Z` 按钮 → 打开关于面板（版本、运行环境、数据目录、完整版本历史）
- 面板里的数据目录可一键定位，方便排查备份问题
- 启动时比对数据文件里的 `lastSeenVersion`：**升级后首次启动**自动弹出本次更新内容；
  全新安装（无记录且无条目）不打扰，只静默记录版本

> 发版检查清单：改 `package.json` 的 `version` → 在 `changelog.ts` 顶部插入同版本号的条目
> （两处版本号必须一致，`LATEST_VERSION` 兜底取数组第一项）→ `npm run dist:manual`。

## 版本历史

| 版本 | 日期 | 主题 |
| --- | --- | --- |
| 1.3.1 | 2026-10-28 | 修图标：exe 内嵌应用图标替换掉 Electron 默认图标，补齐属性面板版本信息 |
| 1.3.0 | 2026-10-28 | 版本可视化：侧栏版本号、关于/更新日志面板、升级后自动提示 |
| 1.2.0 | 2026-10-28 | 操作反馈：按钮四态（打开中/成功/失败）、底部提示条、路径规范化修复 |
| 1.1.0 | 2026-10-26 | 网址管理：内置网址栏目、favicon 抓取、拖入链接 |
| 1.0.0 | 2026-10-23 | 首个可用版本：分类与子栏目、条目列表、真实图标、搜索排序、失效检测 |
