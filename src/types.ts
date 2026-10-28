export type SortMode = 'added-desc' | 'added-asc' | 'name-asc' | 'name-desc'

/** 栏目类型：file = 本地文件/软件，url = 网址栏目（内置，不可删除） */
export type CategoryType = 'file' | 'url'

export interface Category {
  id: string
  name: string
  icon: string
  type?: CategoryType
}

/** 子栏目：挂在某个分类下，例如「软件 / AI软件」 */
export interface SubCategory {
  id: string
  categoryId: string
  name: string
}

/** 条目类型：file/folder 来自本地路径探测，url 为网址条目（path 字段存 URL） */
export type ItemKind = 'file' | 'folder' | 'url'

export interface Item {
  id: string
  name: string
  /** 本地路径，或网址条目时的完整 URL */
  path: string
  kind: ItemKind
  categoryId: string
  /** 所属子栏目，空表示分类下未分组 */
  subId?: string
  addedAt: number
  note?: string
}

export interface AppData {
  version: number
  categories: Category[]
  subs: SubCategory[]
  items: Item[]
  sort: SortMode
  /** 上次运行过的软件版本，用于判断是否需要弹出更新日志 */
  lastSeenVersion?: string
}

/** 侧栏/视图选中项：'all' | `c:<分类id>` | `s:<子栏目id>` */
export type ViewKey = string
