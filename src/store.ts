import type { AppData, Category, Item, ItemKind, SortMode, SubCategory } from './types'

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Windows 路径分隔符兼容：同时处理 / 和 \ */
export function basename(p: string): string {
  if (!p) return ''
  const clean = p.replace(/[\\/]+$/, '')
  return clean.split(/[\\/]/).pop() || clean
}

const DEFAULT_ICONS = ['🧩', '📁', '🎮', '🛠️', '📚', '🎬', '🎵', '📊', '🔧', '☁️', '🧪', '🌐', '🗂️']
export const CATEGORY_ICON_CHOICES = DEFAULT_ICONS

function defaultCategories(): Category[] {
  return [
    { id: uid(), name: '网址', icon: '🌐', type: 'url' },
    { id: uid(), name: '软件', icon: '🧩', type: 'file' },
    { id: uid(), name: '文件', icon: '📁', type: 'file' },
    { id: uid(), name: '文件夹', icon: '🗂️', type: 'file' },
  ]
}

export function createDefaultData(): AppData {
  return { version: 3, categories: defaultCategories(), subs: [], items: [], sort: 'added-desc' }
}

const SORT_MODES: SortMode[] = ['added-desc', 'added-asc', 'name-asc', 'name-desc']

/** 补全协议并校验，非法返回 ''（只接受 http / https） */
export function normalizeUrl(input: string): string {
  const t = input.trim()
  if (!t) return ''
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    const host = u.hostname
    // 至少要有域名结构（localhost 例外），避免把盘符之类误判成网址
    if (!host.includes('.') && host !== 'localhost' && !host.includes(':')) return ''
    return u.href
  } catch {
    return ''
  }
}

/** 取域名（去掉 www.），失败返回空串 */
export function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

/** 拿不到 favicon 时的兜底：域名首字母 + 稳定配色 */
export function urlBadge(url: string): { letter: string; hue: number } {
  const host = urlHost(url) || url
  const letter = (host.split('.')[0] || host || '?').trim().charAt(0).toUpperCase() || '?'
  let h = 0
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0
  return { letter, hue: h % 360 }
}

export const isUrlCategory = (c: Category): boolean => c.type === 'url'
export const isUrlItem = (i: Item): boolean => i.kind === 'url'

/** 兜底清洗：任何字段缺失/类型异常都不让应用崩掉（兼容 v1/v2 旧数据） */
export function sanitize(raw: unknown): AppData {
  const fallback = createDefaultData()
  if (!raw || typeof raw !== 'object') return fallback
  const obj = raw as Partial<AppData>

  const categories: Category[] = Array.isArray(obj.categories)
    ? obj.categories
        .filter((c): c is Category => !!c && typeof c.id === 'string' && typeof c.name === 'string')
        .map((c) => ({
          id: c.id,
          name: c.name,
          icon: typeof c.icon === 'string' && c.icon ? c.icon : '📁',
          type: c.type === 'url' ? 'url' : 'file',
        }))
    : []

  // 网址栏目是内置栏目，缺失时补一个（旧数据升级场景）
  if (!categories.some((c) => c.type === 'url')) {
    categories.unshift({ id: uid(), name: '网址', icon: '🌐', type: 'url' })
  }

  const validCatIds = new Set(categories.map((c) => c.id))
  const urlCatId = categories.find((c) => c.type === 'url')!.id

  const subs: SubCategory[] = Array.isArray(obj.subs)
    ? obj.subs
        .filter(
          (s): s is SubCategory =>
            !!s && typeof s.id === 'string' && typeof s.name === 'string' && validCatIds.has(s.categoryId),
        )
        .map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name }))
    : []

  const validSubIds = new Set(subs.map((s) => s.id))
  const catById = new Map(categories.map((c) => [c.id, c]))

  const items: Item[] = Array.isArray(obj.items)
    ? obj.items
        .filter((i): i is Item => !!i && typeof i.id === 'string' && typeof i.path === 'string')
        .map((i) => {
          const kind: ItemKind = i.kind === 'url' ? 'url' : i.kind === 'folder' ? 'folder' : 'file'
          let categoryId = validCatIds.has(i.categoryId) ? i.categoryId : (categories[0]?.id ?? '')
          let subId = typeof i.subId === 'string' && validSubIds.has(i.subId) ? i.subId : undefined
          // 网址条目只能待在网址栏目，文件条目不能混进网址栏目
          if (kind === 'url' && catById.get(categoryId)?.type !== 'url') {
            categoryId = urlCatId
            subId = undefined
          } else if (kind !== 'url' && catById.get(categoryId)?.type === 'url') {
            categoryId = categories.find((c) => c.type === 'file')?.id ?? categoryId
            subId = undefined
          }
          return {
            id: i.id,
            name: typeof i.name === 'string' && i.name ? i.name : basename(i.path) || i.path,
            path: i.path,
            categoryId,
            subId,
            addedAt: typeof i.addedAt === 'number' ? i.addedAt : Date.now(),
            kind,
            note: typeof i.note === 'string' ? i.note : '',
          }
        })
    : []

  return {
    version: 3,
    categories: categories.length ? categories : fallback.categories,
    subs: categories.length ? subs : [],
    // 没有任何分类时条目必然悬空，直接丢弃，避免出现无法归类的幽灵数据
    items: categories.length ? items : [],
    sort: SORT_MODES.includes(obj.sort as SortMode) ? (obj.sort as SortMode) : 'added-desc',
    lastSeenVersion: typeof obj.lastSeenVersion === 'string' ? obj.lastSeenVersion : undefined,
  }
}

export function sortItems(items: Item[], mode: SortMode): Item[] {
  const arr = [...items]
  switch (mode) {
    case 'added-desc':
      return arr.sort((a, b) => b.addedAt - a.addedAt)
    case 'added-asc':
      return arr.sort((a, b) => a.addedAt - b.addedAt)
    case 'name-asc':
      return arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
    case 'name-desc':
      return arr.sort((a, b) => b.name.localeCompare(a.name, 'zh-Hans-CN'))
    default:
      return arr
  }
}

/** 视图 key 解析 */
export function parseView(key: string): { kind: 'all' | 'cat' | 'sub'; id: string } {
  if (key === 'all') return { kind: 'all', id: '' }
  if (key.startsWith('c:')) return { kind: 'cat', id: key.slice(2) }
  if (key.startsWith('s:')) return { kind: 'sub', id: key.slice(2) }
  return { kind: 'all', id: '' }
}

export const viewCat = (id: string) => `c:${id}`
export const viewSub = (id: string) => `s:${id}`
