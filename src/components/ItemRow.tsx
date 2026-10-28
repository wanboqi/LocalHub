import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { urlBadge, urlHost } from '../store'
import type { Category, Item, SubCategory } from '../types'

/** 按钮动作状态：pending 期间禁用防连点，结束后短暂展示结果再回落 */
type ActState = 'idle' | 'pending' | 'done' | 'error'

function useAction() {
  const [state, setState] = useState<ActState>('idle')
  const busy = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const run = useCallback(async (fn: () => Promise<boolean> | boolean) => {
    if (busy.current) return
    busy.current = true
    window.clearTimeout(timer.current)
    setState('pending')
    let ok = false
    try {
      ok = await fn()
    } catch {
      ok = false
    }
    busy.current = false
    setState(ok ? 'done' : 'error')
    timer.current = window.setTimeout(() => setState('idle'), ok ? 1400 : 2400)
  }, [])

  return { state, run }
}

/** 按状态渲染按钮内容：打开 / 打开中 / ✓ 已打开 / ✕ 失败 */
function actionContent(state: ActState, idleText: string) {
  if (state === 'pending') {
    return (
      <>
        <i className="spin" />
        {idleText}中
      </>
    )
  }
  if (state === 'done') return <>✓ 已{idleText}</>
  if (state === 'error') return <>✕ 失败</>
  return <>{idleText}</>
}

/** 拿不到系统图标时的兜底 emoji */
function guessIcon(item: Item): string {
  if (item.kind === 'folder') return '📁'
  const p = item.path.toLowerCase()
  if (/\.(exe|msi|bat|cmd|com)$/.test(p)) return '⚙️'
  if (/\.(lnk|url)$/.test(p)) return '🔗'
  if (/\.(png|jpe?g|gif|bmp|webp|svg|ico)$/.test(p)) return '🖼️'
  if (/\.(mp4|mkv|avi|mov|wmv|flv)$/.test(p)) return '🎬'
  if (/\.(mp3|wav|flac|m4a|aac)$/.test(p)) return '🎵'
  if (/\.(zip|rar|7z|tar|gz)$/.test(p)) return '🗜️'
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|md|csv)$/.test(p)) return '📄'
  if (/\.(js|ts|tsx|jsx|json|html|css|py|go|rs|java|c|cpp|h)$/.test(p)) return '📝'
  return '📦'
}

interface ItemRowProps {
  item: Item
  icon: string | null | undefined
  valid: boolean | undefined
  subs: SubCategory[]
  categories: Category[]
  onOpen: () => Promise<boolean> | boolean
  onReveal: () => Promise<boolean> | boolean
  onNote: (note: string) => void
  onSub: (subId: string | undefined) => void
  onEdit: () => void
  onDelete: () => void
  onMove: (categoryId: string) => void
}

export default function ItemRow(props: ItemRowProps) {
  const { item, icon, valid, subs, categories } = props
  const isUrl = item.kind === 'url'
  const [menuOpen, setMenuOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const [note, setNote] = useState(item.note ?? '')
  const menuRef = useRef<HTMLDivElement>(null)
  const broken = valid === false && !isUrl
  const openAct = useAction()
  const revealAct = useAction()

  useEffect(() => {
    setNote(item.note ?? '')
  }, [item.note, item.id])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setMoving(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const commitNote = () => {
    const next = note.trim()
    if (next !== (item.note ?? '')) props.onNote(next)
  }

  function closeMenu() {
    setMenuOpen(false)
    setMoving(false)
  }

  function renderMenu() {
    if (!menuOpen) return null

    if (moving) {
      // 网址条目只能在网址栏目之间移动，文件条目反之
      const others = categories.filter(
        (c) => c.id !== item.categoryId && (isUrl ? c.type === 'url' : c.type !== 'url'),
      )
      return (
        <div className="popover">
          <div className="popover-title">移动到分类</div>
          {others.length === 0 ? (
            <div className="popover-item disabled">没有其他可用分类</div>
          ) : (
            others.map((c) => (
              <button
                key={c.id}
                className="popover-item"
                onClick={() => {
                  props.onMove(c.id)
                  closeMenu()
                }}
              >
                {c.icon} {c.name}
              </button>
            ))
          )}
        </div>
      )
    }

    return (
      <div className="popover">
        <button
          className="popover-item"
          onClick={() => {
            closeMenu()
            props.onEdit()
          }}
        >
          ✎ 重命名 / 归类
        </button>
        <button className="popover-item" onClick={() => setMoving(true)}>
          ⇄ 移动到分类
        </button>
        <button
          className="popover-item"
          onClick={() => {
            closeMenu()
            void navigator.clipboard?.writeText(item.path)
          }}
        >
          ⧉ {isUrl ? '复制链接' : '复制路径'}
        </button>
        <button
          className="popover-item danger"
          onClick={() => {
            closeMenu()
            props.onDelete()
          }}
        >
          🗑 移除条目
        </button>
      </div>
    )
  }

  function renderIcon() {
    if (icon) return <img src={icon} alt="" />
    if (isUrl) {
      const { letter, hue } = urlBadge(item.path)
      return (
        <span className="url-badge" style={{ backgroundColor: `hsl(${hue} 62% 52%)` }}>
          {letter}
        </span>
      )
    }
    return <span>{guessIcon(item)}</span>
  }

  // 备注输入、子栏目下拉、按钮上的双击属于编辑动作，不应触发打开
  const onRowDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input, select, button, .popover')) return
    void openAct.run(props.onOpen)
  }

  return (
    <div className={`row ${broken ? 'broken' : ''}`} onDoubleClick={onRowDoubleClick} title={item.path}>
      <div className="row-icon">{renderIcon()}</div>

      <div className="row-name">
        <span className="row-name-text">{item.name}</span>
        {broken ? <span className="row-tag danger">路径失效</span> : null}
        {isUrl ? <span className="row-tag url">{urlHost(item.path)}</span> : null}
        {item.kind === 'folder' ? <span className="row-tag">文件夹</span> : null}
      </div>

      <div className="row-note">
        <input
          value={note}
          placeholder="添加备注…"
          maxLength={120}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setNote(item.note ?? '')
              e.currentTarget.blur()
            }
          }}
        />
      </div>

      <div className="row-sub">
        {subs.length === 0 ? (
          <span className="row-sub-empty" title="在左侧分类上点 ⊞ 新建子栏目">
            —
          </span>
        ) : (
          <select
            value={item.subId ?? ''}
            onChange={(e) => props.onSub(e.target.value || undefined)}
            title="所属子栏目"
          >
            <option value="">未分类</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="row-actions">
        <button
          className={`btn mini primary act ${openAct.state}`}
          disabled={openAct.state === 'pending'}
          onClick={() => void openAct.run(props.onOpen)}
          title={isUrl ? '在默认浏览器中打开' : '打开此项目（也可双击整行）'}
        >
          {actionContent(openAct.state, isUrl ? '访问' : '打开')}
        </button>
        {isUrl ? null : (
          <button
            className={`btn mini act ${revealAct.state}`}
            disabled={broken || revealAct.state === 'pending'}
            onClick={() => void revealAct.run(props.onReveal)}
            title={broken ? '路径已失效' : '在资源管理器中定位'}
          >
            {actionContent(revealAct.state, '定位')}
          </button>
        )}
        <div className="row-menu" ref={menuRef}>
          <button
            className="icon-btn"
            onClick={() => {
              setMenuOpen((v) => !v)
              setMoving(false)
            }}
            title="更多操作"
          >
            ⋯
          </button>
          {renderMenu()}
        </div>
      </div>
    </div>
  )
}
