import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import Toolbar from './components/Toolbar'
import type { ToolbarMode } from './components/Toolbar'
import ItemRow from './components/ItemRow'
import AboutDialog from './components/AboutDialog'
import type { AppInfo } from '../electron/preload'
import { LATEST_VERSION } from './changelog'
import {
  CategoryDialog,
  ConfirmDialog,
  ItemEditDialog,
  PickCategoryDialog,
  SubDialog,
  UrlDialog,
} from './components/Dialogs'
import { basename, createDefaultData, normalizeUrl, parseView, sanitize, sortItems, uid, urlHost, viewCat, viewSub } from './store'
import type { AppData, Category, Item, SortMode, SubCategory, ViewKey } from './types'
import './styles.css'

type ModalState =
  | { type: 'category'; category: Category | null }
  | { type: 'sub'; sub: SubCategory | null; categoryId: string }
  | { type: 'item'; item: Item }
  | { type: 'url'; categoryId: string; subId?: string }
  | { type: 'confirm-category'; category: Category }
  | { type: 'confirm-sub'; sub: SubCategory }
  | { type: 'confirm-item'; item: Item }
  | { type: 'pick-category'; paths: string[] }
  | { type: 'about'; fresh?: boolean }

interface Group {
  key: string
  title: string | null
  items: Item[]
}

export default function App() {
  const [data, setData] = useState<AppData>(createDefaultData)
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState<ViewKey>('all')
  const [query, setQuery] = useState('')
  const [icons, setIcons] = useState<Record<string, string | null>>({})
  const [probe, setProbe] = useState<Record<string, { exists: boolean; isDirectory: boolean }>>({})
  const [checking, setChecking] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const version = appInfo?.version ?? LATEST_VERSION
  const updateChecked = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  /* 载入 */
  useEffect(() => {
    let alive = true
    window.api
      .load()
      .then((raw) => {
        if (!alive) return
        setData(sanitize(raw))
        setReady(true)
      })
      .catch(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  /* 版本信息（主进程 app.getVersion()） */
  useEffect(() => {
    let alive = true
    window.api
      .info()
      .then((info) => {
        if (!alive) return
        setAppInfo(info)
        document.title = `LocalHub v${info.version}`
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  /* 升级后首次启动：弹出本次更新内容；全新安装不打扰，只记下版本 */
  useEffect(() => {
    if (!ready || !appInfo || updateChecked.current) return
    updateChecked.current = true
    const seen = data.lastSeenVersion
    if (seen === appInfo.version) return
    const shouldTell = seen !== undefined || data.items.length > 0
    setData((prev) => ({ ...prev, lastSeenVersion: appInfo.version }))
    if (shouldTell) setModal({ type: 'about', fresh: true })
  }, [ready, appInfo, data.lastSeenVersion, data.items.length])

  /* 保存（防抖） */
  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(() => {
      window.api.save(data).catch(() => showToast('保存失败', 'err'))
    }, 250)
    return () => window.clearTimeout(t)
  }, [data, ready, showToast])

  /* 图标：仅请求尚未取过的目标（网址走 favicon 抓取，本地路径走系统/PE 图标） */
  useEffect(() => {
    const missing = data.items.map((i) => i.path).filter((p) => !(p in icons))
    if (missing.length === 0) return
    let alive = true
    window.api
      .icons(missing)
      .then((res) => {
        if (alive) setIcons((prev) => ({ ...prev, ...res }))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [data.items, icons])

  /* 路径失效检测（网址条目不参与） */
  const checkPaths = useCallback(async () => {
    const paths = data.items.filter((i) => i.kind !== 'url').map((i) => i.path)
    if (paths.length === 0) {
      setProbe({})
      return
    }
    setChecking(true)
    try {
      setProbe(await window.api.probe(paths))
    } finally {
      setChecking(false)
    }
  }, [data.items])

  useEffect(() => {
    if (ready) void checkPaths()
  }, [ready, checkPaths])

  /* Ctrl/Cmd + F 聚焦搜索 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /* ---------------- 派生数据 ---------------- */

  const view = parseView(active)
  const activeSub = view.kind === 'sub' ? data.subs.find((s) => s.id === view.id) : undefined
  const activeCatId =
    view.kind === 'cat' ? view.id : view.kind === 'sub' ? (activeSub?.categoryId ?? '') : ''
  const activeCategory = data.categories.find((c) => c.id === activeCatId)

  const urlCategories = useMemo(() => data.categories.filter((c) => c.type === 'url'), [data.categories])
  const urlCatId = urlCategories[0]?.id ?? ''
  const isUrlView = activeCategory?.type === 'url'
  const toolbarMode: ToolbarMode = view.kind === 'all' ? 'all' : isUrlView ? 'url' : 'file'

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const i of data.items) m[i.categoryId] = (m[i.categoryId] ?? 0) + 1
    return m
  }, [data.items])

  const subCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const i of data.items) if (i.subId) m[i.subId] = (m[i.subId] ?? 0) + 1
    return m
  }, [data.items])

  const subsOfCat = useMemo(() => {
    const m: Record<string, SubCategory[]> = {}
    for (const s of data.subs) (m[s.categoryId] ??= []).push(s)
    return m
  }, [data.subs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const scoped =
      view.kind === 'all'
        ? data.items
        : view.kind === 'cat'
          ? data.items.filter((i) => i.categoryId === view.id)
          : data.items.filter((i) => i.subId === view.id)
    const list = q
      ? scoped.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.note ?? '').toLowerCase().includes(q) ||
            i.path.toLowerCase().includes(q),
        )
      : scoped
    return sortItems(list, data.sort)
  }, [data.items, data.sort, view.kind, view.id, query])

  const groups = useMemo<Group[]>(() => {
    if (view.kind === 'sub') return [{ key: 'single', title: null, items: filtered }]

    if (view.kind === 'cat') {
      const list = subsOfCat[view.id] ?? []
      if (list.length === 0) return [{ key: 'single', title: null, items: filtered }]
      const used = new Set(list.map((s) => s.id))
      const gs: Group[] = list.map((s) => ({
        key: s.id,
        title: s.name,
        items: filtered.filter((i) => i.subId === s.id),
      }))
      const rest = filtered.filter((i) => !i.subId || !used.has(i.subId))
      if (rest.length) gs.push({ key: 'unsorted', title: '未分类', items: rest })
      return gs
    }

    return data.categories
      .map((c) => ({
        key: c.id,
        title: `${c.icon} ${c.name}`,
        items: filtered.filter((i) => i.categoryId === c.id),
      }))
      .filter((g) => g.items.length > 0)
  }, [view.kind, view.id, filtered, subsOfCat, data.categories])

  const invalidCount = useMemo(
    () => data.items.filter((i) => i.kind !== 'url' && probe[i.path]?.exists === false).length,
    [data.items, probe],
  )

  const activeName =
    view.kind === 'all' ? '全部' : view.kind === 'cat' ? (activeCategory?.name ?? '全部') : (activeSub?.name ?? '全部')

  /* ---------------- 条目操作 ---------------- */

  const addPaths = useCallback(
    (paths: string[], categoryId: string, subId?: string) => {
      const clean = paths.filter(Boolean)
      if (clean.length === 0) return
      const known = new Set(
        data.items.filter((i) => i.categoryId === categoryId).map((i) => i.path.toLowerCase()),
      )
      const fresh = clean.filter((p) => !known.has(p.toLowerCase()))
      const dup = clean.length - fresh.length
      if (fresh.length === 0) {
        showToast(`该分类下已存在这 ${dup} 个项目`, 'err')
        return
      }
      const created: Item[] = fresh.map((p) => ({
        id: uid(),
        name: basename(p),
        path: p,
        kind: 'file',
        categoryId,
        subId,
        addedAt: Date.now(),
        note: '',
      }))
      // 目录类型由主进程 stat 结果回填
      void window.api
        .probe(fresh)
        .then((res) => {
          setData((prev) => ({
            ...prev,
            items: prev.items.map((it) => {
              const hit = res[it.path]
              return hit ? { ...it, kind: hit.isDirectory ? 'folder' : 'file' } : it
            }),
          }))
        })
        .catch(() => {})
      setData((prev) => ({ ...prev, items: [...prev.items, ...created] }))
      showToast(`已添加 ${fresh.length} 项${dup > 0 ? `，跳过 ${dup} 项重复` : ''}`, 'ok')
    },
    [data.items, showToast],
  )

  /** 决定新条目落入哪个分类：当前在子栏目就落到子栏目，在分类就落到分类 */
  const addByView = useCallback(
    (paths: string[]) => {
      const targets = data.categories.filter((c) => c.type !== 'url')
      if (targets.length === 0) {
        showToast('请先创建一个分类', 'err')
        return
      }
      if (view.kind === 'sub' && activeSub) addPaths(paths, activeSub.categoryId, activeSub.id)
      else if (view.kind === 'cat' && activeCategory?.type !== 'url') addPaths(paths, view.id)
      else setModal({ type: 'pick-category', paths })
    },
    [activeCategory, activeSub, addPaths, data.categories, showToast, view.id, view.kind],
  )

  const pickAndAdd = useCallback(
    async (kind: 'file' | 'folder') => {
      const paths = await window.api.pick(kind)
      if (paths.length === 0) return
      addByView(paths)
    },
    [addByView],
  )

  /** 批量收录网址（拖入链接 / 粘贴） */
  const addUrls = useCallback(
    (urls: string[], subId?: string) => {
      if (!urlCatId) {
        showToast('没有网址栏目', 'err')
        return
      }
      const known = new Set(
        data.items
          .filter((i) => i.categoryId === urlCatId)
          .map((i) => normalizeUrl(i.path).toLowerCase()),
      )
      const fresh = urls.filter((u) => !known.has(u.toLowerCase()))
      const dup = urls.length - fresh.length
      if (fresh.length === 0) {
        showToast(`网址栏目下已有这 ${dup} 个网址`, 'err')
        return
      }
      const created: Item[] = fresh.map((u) => ({
        id: uid(),
        name: urlHost(u) || u,
        path: u,
        kind: 'url',
        categoryId: urlCatId,
        subId,
        addedAt: Date.now(),
        note: '',
      }))
      setData((prev) => ({ ...prev, items: [...prev.items, ...created] }))
      showToast(`已添加 ${fresh.length} 个网址${dup > 0 ? `，跳过 ${dup} 个重复` : ''}`, 'ok')
    },
    [data.items, showToast, urlCatId],
  )

  /** 网址弹窗：单个新增，支持「保存并继续」连续录入 */
  const addOneUrl = useCallback(
    (name: string, url: string, note: string, subId: string | undefined, keepOpen: boolean) => {
      if (!urlCatId) return
      const exists = data.items.some(
        (i) => i.categoryId === urlCatId && normalizeUrl(i.path).toLowerCase() === url.toLowerCase(),
      )
      if (exists) {
        showToast('这个网址已经在列表里了', 'err')
        return
      }
      setData((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          { id: uid(), name, path: url, kind: 'url', categoryId: urlCatId, subId, addedAt: Date.now(), note },
        ],
      }))
      showToast(`已添加「${name}」`, 'ok')
      if (!keepOpen) setModal(null)
    },
    [data.items, showToast, urlCatId],
  )

  const openUrlDialog = useCallback(() => {
    if (!urlCatId) {
      showToast('没有网址栏目', 'err')
      return
    }
    setModal({
      type: 'url',
      categoryId: urlCatId,
      subId: isUrlView && view.kind === 'sub' ? view.id : undefined,
    })
  }, [isUrlView, showToast, urlCatId, view.id, view.kind])

  const openItem = useCallback(
    async (item: Item): Promise<boolean> => {
      try {
        const res = await window.api.open(item.path)
        if (!res.ok) {
          showToast(`打开失败：${res.error ?? '未知错误'}`, 'err')
          return false
        }
        showToast(item.kind === 'url' ? `已在浏览器中打开「${item.name}」` : `已打开「${item.name}」`, 'ok')
        return true
      } catch (e) {
        showToast(`打开失败：${e instanceof Error ? e.message : '未知错误'}`, 'err')
        return false
      }
    },
    [showToast],
  )

  const revealItem = useCallback(
    async (item: Item): Promise<boolean> => {
      try {
        const res = await window.api.reveal(item.path)
        if (!res.ok) {
          showToast(`定位失败：${res.error ?? '未知错误'}`, 'err')
          return false
        }
        return true
      } catch (e) {
        showToast(`定位失败：${e instanceof Error ? e.message : '未知错误'}`, 'err')
        return false
      }
    },
    [showToast],
  )

  const patchItem = useCallback((id: string, patch: Partial<Item>) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }))
  }, [])

  const saveItem = useCallback(
    (id: string, patch: Pick<Item, 'name' | 'note' | 'categoryId' | 'subId' | 'path'>) => {
      patchItem(id, patch)
      setModal(null)
    },
    [patchItem],
  )

  const removeItem = useCallback((id: string) => {
    setData((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }))
    setModal(null)
  }, [])

  const moveItem = useCallback(
    (id: string, categoryId: string) => {
      patchItem(id, { categoryId, subId: undefined })
    },
    [patchItem],
  )

  /* ---------------- 分类 / 子栏目操作 ---------------- */

  const saveCategory = useCallback(
    (name: string, icon: string) => {
      setData((prev) => {
        const target = modal && modal.type === 'category' ? modal.category : null
        if (target) {
          return {
            ...prev,
            categories: prev.categories.map((c) => (c.id === target.id ? { ...c, name, icon } : c)),
          }
        }
        return { ...prev, categories: [...prev.categories, { id: uid(), name, icon, type: 'file' }] }
      })
      setModal(null)
    },
    [modal],
  )

  const removeCategory = useCallback(
    (categoryId: string) => {
      const cat = data.categories.find((c) => c.id === categoryId)
      setModal(null)
      if (!cat) return
      if (cat.type === 'url') {
        showToast('「网址」是内置栏目，不能删除', 'err')
        return
      }
      setData((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== categoryId),
        subs: prev.subs.filter((s) => s.categoryId !== categoryId),
        items: prev.items.filter((i) => i.categoryId !== categoryId),
      }))
      setActive('all')
    },
    [data.categories, showToast],
  )

  const saveSub = useCallback(
    (name: string) => {
      setData((prev) => {
        if (modal?.type !== 'sub') return prev
        if (modal.sub) {
          return { ...prev, subs: prev.subs.map((s) => (s.id === modal.sub!.id ? { ...s, name } : s)) }
        }
        return { ...prev, subs: [...prev.subs, { id: uid(), categoryId: modal.categoryId, name }] }
      })
      setModal(null)
    },
    [modal],
  )

  const removeSub = useCallback((sub: SubCategory) => {
    setData((prev) => ({
      ...prev,
      subs: prev.subs.filter((s) => s.id !== sub.id),
      // 删除子栏目只是取消分组，条目仍留在原分类
      items: prev.items.map((i) => (i.subId === sub.id ? { ...i, subId: undefined } : i)),
    }))
    setModal(null)
    setActive((cur) => (cur === viewSub(sub.id) ? viewCat(sub.categoryId) : cur))
  }, [])

  /* ---------------- 拖放 ---------------- */

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)

    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length > 0) {
      if (isUrlView) {
        showToast('网址栏目只收录网址，文件请拖到别的分类', 'err')
        return
      }
      const paths = files
        .map((f) => {
          try {
            return window.api.pathFor(f)
          } catch {
            return ''
          }
        })
        .filter(Boolean)
      if (paths.length === 0) return
      addByView(paths)
      return
    }

    // 没有文件，可能是从浏览器地址栏拖进来的链接
    const raw =
      e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || ''
    const urls = raw
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('#'))
      .map(normalizeUrl)
      .filter(Boolean)
    if (urls.length === 0) return
    addUrls(urls, isUrlView && view.kind === 'sub' ? view.id : undefined)
  }

  const totalVisible = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="app">
      <Sidebar
        categories={data.categories}
        subs={data.subs}
        active={active}
        catCounts={catCounts}
        subCounts={subCounts}
        total={data.items.length}
        invalidCount={invalidCount}
        version={version}
        onAbout={() => setModal({ type: 'about' })}
        onSelect={setActive}
        onCreate={() => setModal({ type: 'category', category: null })}
        onEdit={(c) => setModal({ type: 'category', category: c })}
        onDelete={(c) => setModal({ type: 'confirm-category', category: c })}
        onCreateSub={(categoryId) => setModal({ type: 'sub', sub: null, categoryId })}
        onRenameSub={(sub) => setModal({ type: 'sub', sub, categoryId: sub.categoryId })}
        onDeleteSub={(sub) => setModal({ type: 'confirm-sub', sub })}
      />

      <main
        className={`content ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false)
        }}
        onDrop={onDrop}
      >
        <Toolbar
          query={query}
          onQuery={setQuery}
          inputRef={searchRef}
          sort={data.sort}
          onSort={(v: SortMode) => setData((p) => ({ ...p, sort: v }))}
          mode={toolbarMode}
          onAddFile={() => void pickAndAdd('file')}
          onAddFolder={() => void pickAndAdd('folder')}
          onAddUrl={openUrlDialog}
          onRefresh={() => void checkPaths()}
          checking={checking}
        />

        <div className="list-head-wrap">
          <h1>
            {view.kind === 'sub' && activeCategory ? (
              <span className="crumb">{activeCategory.name} / </span>
            ) : null}
            {activeName}
            <span className="list-count">{totalVisible} 项</span>
          </h1>
          {activeCatId ? (
            <button
              className="btn tiny"
              onClick={() => setModal({ type: 'sub', sub: null, categoryId: activeCatId })}
            >
              ＋ 子栏目
            </button>
          ) : null}
        </div>

        {totalVisible === 0 ? (
          <div className="empty">
            <div className="empty-icon">{isUrlView ? '🌐' : '📥'}</div>
            <p>
              {data.categories.length === 0
                ? '先在左侧创建一个分类'
                : query
                  ? '没有匹配的结果，换个关键词试试'
                  : isUrlView
                    ? '点右上角「＋ 网址」添加，或从浏览器地址栏把链接拖进来'
                    : view.kind === 'sub'
                      ? '这个子栏目还没有内容，拖文件进来即可归到这里'
                      : '把文件或文件夹拖到这里，或点击右上角添加'}
            </p>
          </div>
        ) : (
          <div className="list">
            <div className="list-head">
              <span />
              <span>名称</span>
              <span>备注</span>
              <span>子栏目</span>
              <span />
            </div>

            {groups.map((g) => {
              if (g.items.length === 0) return null
              return (
                <section key={g.key} className="group">
                  {g.title ? (
                    <div className="group-head">
                      <span className="group-title">{g.title}</span>
                      <span className="group-count">{g.items.length}</span>
                    </div>
                  ) : null}
                  {g.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      icon={icons[item.path]}
                      valid={probe[item.path]?.exists}
                      subs={subsOfCat[item.categoryId] ?? []}
                      categories={data.categories}
                      onOpen={() => openItem(item)}
                      onReveal={() => revealItem(item)}
                      onNote={(note) => patchItem(item.id, { note })}
                      onSub={(subId) => patchItem(item.id, { subId })}
                      onEdit={() => setModal({ type: 'item', item })}
                      onDelete={() => setModal({ type: 'confirm-item', item })}
                      onMove={(cid) => moveItem(item.id, cid)}
                    />
                  ))}
                </section>
              )
            })}
          </div>
        )}

        {dragging ? <div className="drop-hint">松手即可添加到「{activeName}」</div> : null}
      </main>

      {modal?.type === 'category' ? (
        <CategoryDialog category={modal.category} onCancel={() => setModal(null)} onSave={saveCategory} />
      ) : null}

      {modal?.type === 'sub' ? (
        <SubDialog
          sub={modal.sub}
          categoryName={data.categories.find((c) => c.id === modal.categoryId)?.name ?? ''}
          onCancel={() => setModal(null)}
          onSave={saveSub}
        />
      ) : null}

      {modal?.type === 'url' ? (
        <UrlDialog
          categoryName={data.categories.find((c) => c.id === modal.categoryId)?.name ?? '网址'}
          subs={data.subs.filter((s) => s.categoryId === modal.categoryId)}
          subId={modal.subId}
          onCancel={() => setModal(null)}
          onSave={addOneUrl}
        />
      ) : null}

      {modal?.type === 'item' ? (
        <ItemEditDialog
          item={modal.item}
          categories={
            modal.item.kind === 'url'
              ? data.categories.filter((c) => c.type === 'url')
              : data.categories.filter((c) => c.type !== 'url')
          }
          subs={data.subs}
          onCancel={() => setModal(null)}
          onSave={(patch) => saveItem(modal.item.id, patch)}
        />
      ) : null}

      {modal?.type === 'confirm-item' ? (
        <ConfirmDialog
          title="移除条目"
          message={
            modal.item.kind === 'url'
              ? `确定从列表中移除「${modal.item.name}」？这只是移除记录，不影响网站本身。`
              : `确定从列表中移除「${modal.item.name}」？这只是移除记录，不会删除磁盘上的文件。`
          }
          confirmText="移除"
          onCancel={() => setModal(null)}
          onConfirm={() => removeItem(modal.item.id)}
        />
      ) : null}

      {modal?.type === 'confirm-category' ? (
        <ConfirmDialog
          title="删除分类"
          message={`删除「${modal.category.name}」会同时移除它的 ${subsOfCat[modal.category.id]?.length ?? 0} 个子栏目、${catCounts[modal.category.id] ?? 0} 个条目（不影响磁盘文件），确定继续？`}
          confirmText="删除"
          onCancel={() => setModal(null)}
          onConfirm={() => removeCategory(modal.category.id)}
        />
      ) : null}

      {modal?.type === 'confirm-sub' ? (
        <ConfirmDialog
          title="删除子栏目"
          message={`删除子栏目「${modal.sub.name}」后，它下面的 ${subCounts[modal.sub.id] ?? 0} 个条目会回到分类下的「未分类」，不会删除任何文件。`}
          confirmText="删除"
          onCancel={() => setModal(null)}
          onConfirm={() => removeSub(modal.sub)}
        />
      ) : null}

      {modal?.type === 'pick-category' ? (
        <PickCategoryDialog
          paths={modal.paths}
          categories={data.categories.filter((c) => c.type !== 'url')}
          subs={data.subs}
          onCancel={() => setModal(null)}
          onPick={(cid, sid) => {
            addPaths(modal.paths, cid, sid)
            setModal(null)
          }}
        />
      ) : null}

      {modal?.type === 'about' ? (
        <AboutDialog
          info={appInfo}
          freshUpdate={modal.fresh}
          onClose={() => setModal(null)}
          onOpenDataDir={(dir) => {
            void window.api.reveal(dir).then((res) => {
              if (!res.ok) showToast(`定位失败：${res.error ?? '未知错误'}`, 'err')
            })
          }}
        />
      ) : null}

      {toast ? <div className={`toast ${toast.kind}`}>{toast.msg}</div> : null}
    </div>
  )
}
