import { useState } from 'react'
import type { Category, SubCategory } from '../types'
import { viewCat, viewSub } from '../store'

interface SidebarProps {
  categories: Category[]
  subs: SubCategory[]
  active: string
  catCounts: Record<string, number>
  subCounts: Record<string, number>
  total: number
  invalidCount: number
  version: string
  onSelect: (key: string) => void
  onAbout: () => void
  onCreate: () => void
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  onCreateSub: (categoryId: string) => void
  onRenameSub: (s: SubCategory) => void
  onDeleteSub: (s: SubCategory) => void
}

export default function Sidebar(props: SidebarProps) {
  const { categories, subs, active, catCounts, subCounts, total, invalidCount } = props
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const subsOf = (categoryId: string) => subs.filter((s) => s.categoryId === categoryId)

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">LH</div>
        <div className="brand-text">
          <strong>LocalHub</strong>
          <span>本地资源管理器</span>
        </div>
      </div>

      <div className="nav-group">
        <button className={`nav-item ${active === 'all' ? 'active' : ''}`} onClick={() => props.onSelect('all')}>
          <span className="nav-icon">🗂️</span>
          <span className="nav-label">全部</span>
          <span className="nav-count">{total}</span>
        </button>

        <div className="nav-title">
          <span>我的分类</span>
          <button className="icon-btn" onClick={props.onCreate} title="新建分类">
            ＋
          </button>
        </div>

        {categories.map((c) => {
          const list = subsOf(c.id)
          const open = !collapsed[c.id]
          const catActive = active === viewCat(c.id)
          const builtin = c.type === 'url'
          return (
            <div key={c.id} className="nav-cat">
              <div className={`nav-item ${catActive ? 'active' : ''}`}>
                <button
                  className="nav-caret"
                  title={open ? '收起' : '展开'}
                  onClick={() => setCollapsed((p) => ({ ...p, [c.id]: open }))}
                  disabled={list.length === 0}
                >
                  {list.length === 0 ? '' : open ? '▾' : '▸'}
                </button>
                <button className="nav-hit" onClick={() => props.onSelect(viewCat(c.id))}>
                  <span className="nav-icon">{c.icon}</span>
                  <span className="nav-label">{c.name}</span>
                  {builtin ? (
                    <span className="nav-badge" title="内置栏目，不能删除">
                      内置
                    </span>
                  ) : null}
                  <span className="nav-count">{catCounts[c.id] ?? 0}</span>
                </button>
                <div className="nav-ops">
                  <button className="icon-btn tiny" onClick={() => props.onCreateSub(c.id)} title="新建子栏目">
                    ⊞
                  </button>
                  <button className="icon-btn tiny" onClick={() => props.onEdit(c)} title="编辑分类">
                    ✎
                  </button>
                  {builtin ? null : (
                    <button className="icon-btn tiny" onClick={() => props.onDelete(c)} title="删除分类">
                      🗑
                    </button>
                  )}
                </div>
              </div>

              {open
                ? list.map((s) => (
                    <div key={s.id} className={`nav-item sub ${active === viewSub(s.id) ? 'active' : ''}`}>
                      <button className="nav-hit" onClick={() => props.onSelect(viewSub(s.id))}>
                        <span className="nav-branch">└</span>
                        <span className="nav-label">{s.name}</span>
                        <span className="nav-count">{subCounts[s.id] ?? 0}</span>
                      </button>
                      <div className="nav-ops">
                        <button className="icon-btn tiny" onClick={() => props.onRenameSub(s)} title="重命名子栏目">
                          ✎
                        </button>
                        <button className="icon-btn tiny" onClick={() => props.onDeleteSub(s)} title="删除子栏目">
                          🗑
                        </button>
                      </div>
                    </div>
                  ))
                : null}
            </div>
          )
        })}

        {categories.length === 0 ? (
          <p className="hint">还没有分类，点击右上角 ＋ 创建第一个。</p>
        ) : null}
      </div>

      <div className="sidebar-foot">
        <span className="foot-status">
          {invalidCount > 0 ? `⚠️ ${invalidCount} 个路径已失效` : '所有路径正常'}
        </span>
        <button className="version-btn" onClick={props.onAbout} title="关于 LocalHub · 更新日志">
          v{props.version}
        </button>
      </div>
    </aside>
  )
}
