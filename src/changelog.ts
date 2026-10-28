/**
 * 版本更新记录（软件内「关于 / 更新日志」面板的数据源）
 *
 * 约定：
 * - 数组按版本从新到旧排列，第一项即当前版本；
 * - 版本号必须与 package.json 的 version 保持一致（打包时由主进程 app.getVersion() 读取）；
 * - 只写用户能感知的变化，内部重构/依赖升级不必罗列。
 */

export type ChangeTag = 'new' | 'improve' | 'fix'

export interface Change {
  tag: ChangeTag
  text: string
}

export interface Release {
  version: string
  /** YYYY-MM-DD */
  date: string
  /** 一句话主题 */
  summary: string
  changes: Change[]
}

export const TAG_LABEL: Record<ChangeTag, string> = {
  new: '新增',
  improve: '优化',
  fix: '修复',
}

export const CHANGELOG: Release[] = [
  {
    version: '1.3.1',
    date: '2026-10-28',
    summary: '修图标：任务栏和资源管理器里不再显示 Electron 的默认图标',
    changes: [
      { tag: 'fix', text: '打包后任务栏、开始菜单、资源管理器里显示的是 Electron 默认的原子图标' },
      { tag: 'improve', text: 'exe 内嵌图标补齐 256/128/64/48/32/16 六个尺寸，高 DPI 下也清晰' },
      { tag: 'improve', text: 'exe 属性面板显示正确的产品名与版本号（原来只有 Electron 的信息）' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-28',
    summary: '版本可视化：随时能看到自己在用哪个版本、每个版本改了什么',
    changes: [
      { tag: 'new', text: '侧栏底部常驻版本号，点击打开「关于 LocalHub」面板' },
      { tag: 'new', text: '「更新日志」按版本列出全部改动，当前版本高亮标记' },
      { tag: 'new', text: '面板内展示运行环境（Electron / Chromium / Node）和数据目录，可一键定位' },
      { tag: 'new', text: '升级后首次启动自动弹出本次更新内容，看过后不再打扰' },
      { tag: 'improve', text: '窗口标题带版本号，方便截图反馈问题时核对' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-28',
    summary: '操作反馈：点完按钮立刻知道有没有成功',
    changes: [
      { tag: 'new', text: '「打开 / 访问 / 定位」按钮四态反馈：打开中… → ✓ 已打开 / ✕ 失败 → 自动复位' },
      { tag: 'new', text: '底部提示条显示成功结果，失败时给出具体原因' },
      { tag: 'improve', text: '按钮定宽，状态切换时不再左右跳动；处理中禁用防连点' },
      { tag: 'fix', text: '修复路径含重复分隔符（如 D://xx）时「打开」失效、「定位」却正常的问题' },
      { tag: 'fix', text: '打开失败的英文报错改为中文，并前置路径存在性检查' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-26',
    summary: '网址管理：常用网站也收进同一个列表',
    changes: [
      { tag: 'new', text: '内置「网址」栏目，点「访问」用默认浏览器打开' },
      { tag: 'new', text: '自动抓取网站 favicon 并本地缓存，抓不到时用域名首字母彩色徽标' },
      { tag: 'new', text: '「＋ 网址」手动录入（可连续添加），或从浏览器把链接直接拖进窗口' },
      { tag: 'improve', text: '网址条目不参与磁盘失效检测，路径列显示域名' },
      { tag: 'improve', text: '数据升级到 v3，旧分类与条目原样保留' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-23',
    summary: '首个可用版本：把散落各处的软件和文件收进一张表',
    changes: [
      { tag: 'new', text: '自定义分类与子栏目（如「软件 → AI 软件 / 影音」）' },
      { tag: 'new', text: '手动选择或拖拽文件、文件夹添加，一条目一行' },
      { tag: 'new', text: '一键「打开」和「打开所在文件夹」' },
      { tag: 'new', text: '解析 exe/dll 的 PE 资源取真实图标，其余类型用系统图标并缓存' },
      { tag: 'new', text: '行内备注编辑、分类/子栏目调整、复制路径、移除条目' },
      { tag: 'new', text: '名称/备注模糊搜索，按添加时间或名称排序' },
      { tag: 'new', text: '启动时检测路径是否失效，失效条目标红并禁用按钮' },
    ],
  },
]

/** 当前版本号（取更新日志第一项，仅用于展示兜底；真实版本以主进程为准） */
export const LATEST_VERSION = CHANGELOG[0]?.version ?? '0.0.0'
