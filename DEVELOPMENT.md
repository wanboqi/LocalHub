# LocalHub 开发文档

面向想要编译、修改或理解实现的人。**只是想用软件的话看 [README.md](./README.md) 就够了。**

## 技术栈

Electron 45 + React 19 + TypeScript + Vite 7，仅支持 Windows（用到 `app.getFileIcon`、
`shell.openPath`、`shell.showItemInFolder` 等系统能力）。

数据全部存在本机 JSON 文件里，没有数据库、没有后端、没有运行时 node 依赖（React 已由 Vite 打进 `dist/`）。

## 环境要求

Node.js 22+（用到内置的 fetch / WebSocket 做打包验证）。Windows 10 / 11 x64。

```bash
npm install
```

> `.npmrc` 里配置了 npmmirror 镜像（registry + electron + electron-builder binaries），
> 国内网络下不用额外折腾。不需要的话删掉这个文件即可。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发模式，Vite 热更新 |
| `npm run build` | 类型检查 + 构建（输出到 `dist/` 和 `dist-electron/`） |
| `npm run typecheck` | 只做类型检查 |
| `npm run dist:manual` | **打包入口**：构建 → 装配 → 出安装包 → 清理临时目录 |
| `npm run clean` | 单独清理打包临时目录 |

> 在 Electron 类终端（如某些 AI 客户端内置终端）里执行 `npm run dev` 时，
> 宿主可能注入 `ELECTRON_RUN_AS_NODE` 导致窗口无法创建，`vite.config.ts` 已在启动前清除该变量。

## 打包

### 为什么不用 `npm run dist`（electron-builder 标准流程）

electron-builder 的依赖收集器会通过 `powershell.exe -EncodedCommand` 调用 `npm list`。
在禁止 spawn 子进程的受限宿主里，该步骤会**静默返回空**（不报错），
结果就是打包时报 `Cannot find module ...` 却查不到原因。

本应用没有运行时 node 依赖，因此可以绕开依赖收集，直接手工装配（这也是 `dist:manual` 做的事）：

```bash
npm run dist:manual
# 等价于：
# npm run build          → dist/ + dist-electron/
# node tools/assemble.js → 复制 electron 运行时到 out/win-unpacked，
#                          exe 改名 LocalHub.exe、写入图标与版本信息，打 app.asar
# node tools/pack.js     → 复用 out/win-unpacked（--prepackaged）生成 nsis + portable
# node tools/clean.js    → 删除 out-stale / .staging
```

产物在 `out/`：`LocalHub-<版本>-Setup.exe`（安装版）和 `LocalHub-<版本>-Portable.exe`（便携版）。

### 打包踩坑记录

**① 批量复制会被系统掐断**
一次性 `fs.cpSync` 复制 300+ 个 dll/exe（357 MB）会导致进程被直接杀掉，表现为 exit 127、
无任何错误输出、目标目录全空；`robocopy` 同样失败。
解法：`tools/copy-tree.js` 分批复制（每批 20 个文件 + 60ms 间隔），`assemble.js` 改用它。

**② `assemble.js` 用「重命名」而不是删除来腾空目标目录**
这是为了绕开批量删除的限制，但副作用是每打一次包就会多一份旧目录（数 GB）。
所以**必须用 `clean.js` 收尾**，否则 `out-stale/` 会迅速膨胀。

**③ `--prepackaged` 不会执行 rcedit**
electron-builder 负责写 exe 图标和版本信息的那一步被跳过了，所以 `tools/set-icon.js`（基于 resedit）补上：
替换 exe 所有图标组的 6 个尺寸（256/128/64/48/32/16），并写 VS_VERSION_INFO（取自 `package.json`）。
否则任务栏/开始菜单/资源管理器里显示的仍是 Electron 默认的原子图标。
它先写 `.icon-tmp` 再 rename，避免 exe 被占用导致失败。

**④ 判断是否为打包版不能用 `app.isPackaged`**
直接运行 `win-unpacked/electron.exe` 时它是 false，会导致界面误显示「开发版」标签。
实际用的是 `app.isPackaged || appPath.includes('.asar')`。

### 窗口图标

走另一条路：`assemble.js` 会把 `icon.ico` 复制到 `resources/`（asar 之外），
主进程优先读 `process.resourcesPath/icon.ico`，dev 模式回退到 `public/icon.ico`。
替换应用图标的源文件由 `tools/make_icon.py` 生成（纯标准库，无需 Pillow）。

## 目录结构

```
electron/
  main.ts       主进程：窗口、IPC、数据读写、打开/定位
  icon.ts       PE 资源图标解析 + 纯标准库 PNG 编码
  favicon.ts    网站图标抓取（超时 4s、跟随重定向、文件头嗅探）
  preload.ts    contextBridge 暴露受控 API
src/
  components/   侧栏、工具栏、条目行、弹窗
  changelog.ts  版本更新记录（软件内「关于」面板的数据源）
  store.ts      数据清洗、URL 规范化、排序、视图 key 工具
  types.ts
tools/
  make_icon.py  生成 public/icon.ico
  shot.js       冒烟测试：启动应用、模拟点击、截图
  assemble.js   手工装配 out/win-unpacked + app.asar
  asar-pack.js  只重打 app.asar（改了 dist/ 不想重装运行时时用）
  pack.js       复用 win-unpacked 生成安装包/便携版
  set-icon.js   往 exe 写入图标与版本信息（resedit）
  copy-tree.js  分批复制目录（绕开批量写入限制）
  clean.js      清理 out-stale / .staging
docs/
  index.html    项目主页（GitHub Pages）
  assets/       界面截图
```

## 数据存储

- 数据文件：`%APPDATA%/LocalHub/data.json`（打包后），开发模式下为 `%APPDATA%/Electron/data.json`
- 图标缓存：`同目录/icon-cache/`，本地文件按「路径 + 修改时间」哈希命名，网址图标按 URL 哈希
- 抓取失败的网址会写 `.miss` 标记，24 小时内不再重复联网（避免每次启动空等超时）
- 写入采用「临时文件 + 原子重命名」，避免写一半崩溃导致数据损坏；读取时对字段做兜底清洗
- 旧版数据自动升级：`version: 1 → 2`（子栏目）、`2 → 3`（网址栏目），原有分类与条目保持不变

移除条目**只删除记录**，不会动磁盘上的真实文件；删除子栏目只是取消分组，条目回到分类下的「未分类」。
网址条目复用 `path` 字段存 URL，因此不参与磁盘路径失效检测。

## 版本号与发版

版本号只有一处来源：`package.json` 的 `version`。运行时由主进程 `app.getVersion()` 读取
（打包后读的是 `app.asar/package.json`），经 IPC `app:info` 传给界面。

发版三步走：

1. 改 `package.json` 的 `version`
2. 在 `src/changelog.ts` 的 `CHANGELOG` 数组**最前面**插入同版本号的条目
   （两处版本号必须一致，`LATEST_VERSION` 兜底取数组第一项），标签用 `new / improve / fix`
3. `npm run dist:manual`

更新日志会被软件内「关于 LocalHub」面板直接渲染：侧栏底部 `vX.Y.Z` 按钮打开面板，
启动时比对数据文件里的 `lastSeenVersion`，**升级后首次启动**自动弹出本次更新内容；
全新安装（无记录且无条目）不打扰，只静默记录版本。

## 验证打包结果的做法

打包版不能用常规的 UI 自动化，Electron 自带的 CDP 最直接：

```bash
env -u ELECTRON_RUN_AS_NODE ./out/win-unpacked/LocalHub.exe --remote-debugging-port=9222
```

然后连 `http://127.0.0.1:9222/json/list` 拿 `webSocketDebuggerUrl`，用 Node 内置的 WebSocket 发 CDP 命令。
注意两点：

- **必须 `env -u ELECTRON_RUN_AS_NODE`**，否则 exe 以 Node 模式直接退出，看不到窗口
- `Page.captureScreenshot` 带 `fromSurface: true` 时，如果页面有 CSS 动画或弹窗，
  会一直等合成帧而**卡死挂起**（不报错）。去掉该参数即可，建议再加超时重试
- 验证前先备份 `data.json`：测试会写入 `lastSeenVersion`，跑完要还原，否则用户看不到升级提示

## 上传到 GitHub

见 [GITHUB_UPLOAD_GUIDE.md](./GITHUB_UPLOAD_GUIDE.md)，包含建仓、推送、开 Pages、发 Release 以及后续版本更新的完整流程。
